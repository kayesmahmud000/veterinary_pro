import 'package:flutter_test/flutter_test.dart';
import 'package:vetralink_mobile/core/sync/sync_models.dart';

void main() {
  group('SyncModels Test Suite', () {
    test('SyncAnimal JSON serialization & DB map roundtrip', () {
      final animal = SyncAnimal(
        id: 'animal-uuid-1',
        farmId: 'farm-uuid-1',
        tagNumber: 'TAG-101',
        rfidNumber: 'RFID-999',
        name: 'Daisy',
        species: 'COW',
        breed: 'Holstein',
        gender: 'FEMALE',
        dateOfBirth: '2023-01-15T00:00:00.000Z',
        weightKg: 450.5,
        status: 'ACTIVE',
        syncVersion: 2,
        createdAt: '2023-01-15T00:00:00.000Z',
        updatedAt: '2023-05-15T00:00:00.000Z',
      );

      final json = animal.toJson();
      final fromJson = SyncAnimal.fromJson(json);

      expect(fromJson.id, animal.id);
      expect(fromJson.farmId, animal.farmId);
      expect(fromJson.tagNumber, 'TAG-101');
      expect(fromJson.weightKg, 450.5);

      final dbMap = animal.toDbMap(isSynced: 1);
      expect(dbMap['is_synced'], 1);
      expect(dbMap['tag_number'], 'TAG-101');

      final fromDb = SyncAnimal.fromDbMap(dbMap);
      expect(fromDb.id, animal.id);
      expect(fromDb.species, 'COW');
    });

    test('SyncMilkLog JSON serialization roundtrip', () {
      final log = SyncMilkLog(
        id: 'milk-uuid-1',
        farmId: 'farm-uuid-1',
        animalId: 'animal-uuid-1',
        recordedById: 'user-uuid-1',
        session: 'MORNING',
        yieldLiters: 18.5,
        fatPercent: 3.8,
        snfPercent: 8.5,
        loggedDate: '2026-09-20',
        syncVersion: 1,
        createdAt: '2026-09-20T06:00:00.000Z',
        updatedAt: '2026-09-20T06:00:00.000Z',
      );

      final json = log.toJson();
      final fromJson = SyncMilkLog.fromJson(json);

      expect(fromJson.yieldLiters, 18.5);
      expect(fromJson.session, 'MORNING');

      final dbMap = log.toDbMap(isSynced: 0);
      expect(dbMap['is_synced'], 0);
      final fromDb = SyncMilkLog.fromDbMap(dbMap);
      expect(fromDb.yieldLiters, 18.5);
    });

    test('SyncPullResponse parsing with nested tables', () {
      final jsonResponse = {
        'farmId': 'farm-1',
        'serverTimestamp': 1726880000000,
        'changes': {
          'animals': {
            'created': [
              {
                'id': 'a1',
                'farmId': 'farm-1',
                'tagNumber': 'TAG-01',
                'species': 'COW',
                'gender': 'FEMALE',
                'status': 'ACTIVE',
                'syncVersion': 1,
                'createdAt': '2026-09-20T00:00:00.000Z',
                'updatedAt': '2026-09-20T00:00:00.000Z',
              }
            ],
            'updated': [],
            'deleted': ['a-deleted-1'],
          },
          'milkLogs': {
            'created': [],
            'updated': [],
            'deleted': [],
          },
          'healthRecords': {
            'created': [],
            'updated': [],
            'deleted': [],
          },
          'vaccineRecords': {
            'created': [],
            'updated': [],
            'deleted': [],
          },
          'weightLogs': {
            'created': [],
            'updated': [],
            'deleted': [],
          },
          'transactions': {
            'created': [],
            'updated': [],
            'deleted': [],
          },
        },
      };

      final pullResponse = SyncPullResponse.fromJson(jsonResponse);
      expect(pullResponse.farmId, 'farm-1');
      expect(pullResponse.serverTimestamp, 1726880000000);
      expect(pullResponse.animals.created.length, 1);
      expect(pullResponse.animals.created.first.tagNumber, 'TAG-01');
      expect(pullResponse.animals.deleted, ['a-deleted-1']);
    });

    test('SyncPushResponse parsing with conflicts', () {
      final jsonResponse = {
        'success': true,
        'serverTimestamp': 1726880005000,
        'appliedCounts': {
          'animals': 2,
          'milkLogs': 5,
          'healthRecords': 0,
          'vaccineRecords': 1,
          'weightLogs': 2,
          'transactions': 1,
        },
        'conflicts': [
          {
            'table': 'animals',
            'recordId': 'a-conflict-1',
            'reason': 'Server version is newer than client edit watermark',
            'resolution': 'SERVER_WINS',
            'serverVersion': 3,
            'clientVersion': 2,
          }
        ],
      };

      final pushResponse = SyncPushResponse.fromJson(jsonResponse);
      expect(pushResponse.success, true);
      expect(pushResponse.appliedCounts['animals'], 2);
      expect(pushResponse.conflicts.length, 1);
      expect(pushResponse.conflicts.first.resolution,
          SyncConflictResolution.serverWins);
      expect(pushResponse.conflicts.first.serverVersion, 3);
    });
  });
}
