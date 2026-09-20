import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'package:uuid/uuid.dart';
import 'offline_database.dart';
import 'sync_client.dart';
import 'sync_models.dart';

class SyncResult {
  final bool success;
  final int pushedCount;
  final int pulledCount;
  final List<SyncConflictItem> conflicts;
  final int serverTimestamp;
  final String? errorMessage;

  SyncResult({
    required this.success,
    this.pushedCount = 0,
    this.pulledCount = 0,
    this.conflicts = const [],
    required this.serverTimestamp,
    this.errorMessage,
  });
}

class OfflineSyncEngine {
  final OfflineDatabase _database;
  final SyncClient _client;
  final Uuid _uuid;

  OfflineSyncEngine({
    OfflineDatabase? database,
    SyncClient? client,
    Uuid? uuid,
  })  : _database = database ?? OfflineDatabase.instance,
        _client = client ?? SyncClient(),
        _uuid = uuid ?? const Uuid();

  /// Enqueue a local mutation when offline or when creating/updating/deleting records
  Future<void> enqueueMutation({
    required String farmId,
    required String tableName,
    required String recordId,
    required SyncOperation operation,
    required Map<String, dynamic> payload,
  }) async {
    final db = await _database.database;
    final id = _uuid.v4();
    final now = DateTime.now().toIso8601String();

    await db.insert('sync_queue', {
      'id': id,
      'farm_id': farmId,
      'table_name': tableName,
      'record_id': recordId,
      'operation': operation.name.toUpperCase(),
      'payload': jsonEncode(payload),
      'created_at': now,
    });
  }

  /// Perform bidirectional synchronization:
  /// 1. Push pending local changes from sync_queue to server
  /// 2. Pull remote delta changes since last watermark from server
  /// 3. Update local SQLite tables and watermark
  Future<SyncResult> synchronize(
    String farmId, {
    String? authToken,
  }) async {
    final db = await _database.database;

    try {
      // 1. Fetch metadata watermark
      final metaRows = await db.query(
        'sync_metadata',
        where: 'farm_id = ?',
        whereArgs: [farmId],
      );
      final lastPulledAt = metaRows.isNotEmpty
          ? metaRows.first['last_pulled_at'] as int?
          : null;

      // 2. Fetch pending mutations from queue
      final queueRows = await db.query(
        'sync_queue',
        where: 'farm_id = ?',
        whereArgs: [farmId],
        orderBy: 'created_at ASC',
      );

      var pushedCount = 0;
      final conflicts = <SyncConflictItem>[];

      // 3. Push local changes if any
      if (queueRows.isNotEmpty) {
        final changesMap = <String, Map<String, List<dynamic>>>{
          'animals': {'created': [], 'updated': [], 'deleted': []},
          'milkLogs': {'created': [], 'updated': [], 'deleted': []},
          'healthRecords': {'created': [], 'updated': [], 'deleted': []},
          'vaccineRecords': {'created': [], 'updated': [], 'deleted': []},
          'weightLogs': {'created': [], 'updated': [], 'deleted': []},
          'transactions': {'created': [], 'updated': [], 'deleted': []},
        };

        for (final row in queueRows) {
          final table = _mapTableToKey(row['table_name'] as String);
          final op = (row['operation'] as String).toUpperCase();
          final payload = jsonDecode(row['payload'] as String);

          if (op == 'CREATE') {
            changesMap[table]?['created']?.add(payload);
          } else if (op == 'UPDATE') {
            changesMap[table]?['updated']?.add(payload);
          } else if (op == 'DELETE') {
            changesMap[table]?['deleted']?.add(row['record_id'] as String);
          }
        }

        final pushPayload = {
          'farmId': farmId,
          'lastPulledAt': lastPulledAt ?? 0,
          'changes': changesMap,
        };

        final pushResponse = await _client.push(
          pushPayload,
          token: authToken,
        );

        if (pushResponse.success) {
          // Calculate total pushed items
          for (final count in pushResponse.appliedCounts.values) {
            pushedCount += count;
          }
          conflicts.addAll(pushResponse.conflicts);

          // Purge pushed queue entries
          final queueIds = queueRows.map((r) => r['id'] as String).toList();
          final placeholders = List.filled(queueIds.length, '?').join(',');
          await db.delete(
            'sync_queue',
            where: 'id IN ($placeholders)',
            whereArgs: queueIds,
          );

          // Update last_pushed_at
          await db.insert(
            'sync_metadata',
            {
              'farm_id': farmId,
              'last_pushed_at': pushResponse.serverTimestamp,
              'updated_at': DateTime.now().toIso8601String(),
            },
            conflictAlgorithm: ConflictAlgorithm.replace,
          );
        }
      }

      // 4. Pull remote changes from server
      final pullResponse = await _client.pull(
        SyncPullRequest(farmId: farmId, lastPulledAt: lastPulledAt),
        token: authToken,
      );

      var pulledCount = 0;

      // 5. Apply pulled changes in a single atomic transaction
      await db.transaction((txn) async {
        // Animals
        for (final a in pullResponse.animals.created) {
          await txn.insert('animals', a.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final a in pullResponse.animals.updated) {
          await txn.insert('animals', a.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final id in pullResponse.animals.deleted) {
          await txn.update(
            'animals',
            {'deleted_at': DateTime.now().toIso8601String(), 'is_synced': 1},
            where: 'id = ?',
            whereArgs: [id],
          );
          pulledCount++;
        }

        // Milk Logs
        for (final m in pullResponse.milkLogs.created) {
          await txn.insert('milk_logs', m.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final m in pullResponse.milkLogs.updated) {
          await txn.insert('milk_logs', m.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final id in pullResponse.milkLogs.deleted) {
          await txn.delete('milk_logs', where: 'id = ?', whereArgs: [id]);
          pulledCount++;
        }

        // Health Records
        for (final h in pullResponse.healthRecords.created) {
          await txn.insert('health_records', h.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final h in pullResponse.healthRecords.updated) {
          await txn.insert('health_records', h.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final id in pullResponse.healthRecords.deleted) {
          await txn.delete('health_records', where: 'id = ?', whereArgs: [id]);
          pulledCount++;
        }

        // Vaccine Records
        for (final v in pullResponse.vaccineRecords.created) {
          await txn.insert('vaccine_records', v.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final v in pullResponse.vaccineRecords.updated) {
          await txn.insert('vaccine_records', v.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final id in pullResponse.vaccineRecords.deleted) {
          await txn.delete('vaccine_records', where: 'id = ?', whereArgs: [id]);
          pulledCount++;
        }

        // Weight Logs
        for (final w in pullResponse.weightLogs.created) {
          await txn.insert('animal_weight_logs', w.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final w in pullResponse.weightLogs.updated) {
          await txn.insert('animal_weight_logs', w.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final id in pullResponse.weightLogs.deleted) {
          await txn.delete('animal_weight_logs', where: 'id = ?', whereArgs: [id]);
          pulledCount++;
        }

        // Transactions
        for (final t in pullResponse.transactions.created) {
          await txn.insert('farm_transactions', t.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final t in pullResponse.transactions.updated) {
          await txn.insert('farm_transactions', t.toDbMap(isSynced: 1),
              conflictAlgorithm: ConflictAlgorithm.replace);
          pulledCount++;
        }
        for (final id in pullResponse.transactions.deleted) {
          await txn.update(
            'farm_transactions',
            {'deleted_at': DateTime.now().toIso8601String(), 'is_synced': 1},
            where: 'id = ?',
            whereArgs: [id],
          );
          pulledCount++;
        }

        // Update watermark in metadata
        await txn.insert(
          'sync_metadata',
          {
            'farm_id': farmId,
            'last_pulled_at': pullResponse.serverTimestamp,
            'status': 'IDLE',
            'updated_at': DateTime.now().toIso8601String(),
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      });

      return SyncResult(
        success: true,
        pushedCount: pushedCount,
        pulledCount: pulledCount,
        conflicts: conflicts,
        serverTimestamp: pullResponse.serverTimestamp,
      );
    } catch (e) {
      return SyncResult(
        success: false,
        serverTimestamp: DateTime.now().millisecondsSinceEpoch,
        errorMessage: e.toString(),
      );
    }
  }

  String _mapTableToKey(String tableName) {
    switch (tableName.toLowerCase()) {
      case 'animals':
        return 'animals';
      case 'milk_logs':
      case 'milklogs':
        return 'milkLogs';
      case 'health_records':
      case 'healthrecords':
        return 'healthRecords';
      case 'vaccine_records':
      case 'vaccinerecords':
        return 'vaccineRecords';
      case 'animal_weight_logs':
      case 'weightlogs':
        return 'weightLogs';
      case 'farm_transactions':
      case 'transactions':
        return 'transactions';
      default:
        return tableName;
    }
  }
}
