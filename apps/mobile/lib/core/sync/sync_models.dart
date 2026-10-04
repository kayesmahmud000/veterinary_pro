import 'dart:convert';

enum SyncOperation { create, update, delete }

enum SyncConflictResolution { serverWins, clientApplied }

// ==========================================
// Entity Models
// ==========================================

class SyncAnimal {
  final String id;
  final String farmId;
  final String tagNumber;
  final String? rfidNumber;
  final String? name;
  final String species;
  final String? breed;
  final String gender;
  final String? dateOfBirth;
  final double? weightKg;
  final String status;
  final String? sireId;
  final String? damId;
  final Map<String, dynamic>? metadata;
  final int syncVersion;
  final String createdAt;
  final String updatedAt;
  final String? deletedAt;

  SyncAnimal({
    required this.id,
    required this.farmId,
    required this.tagNumber,
    this.rfidNumber,
    this.name,
    required this.species,
    this.breed,
    required this.gender,
    this.dateOfBirth,
    this.weightKg,
    required this.status,
    this.sireId,
    this.damId,
    this.metadata,
    required this.syncVersion,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
  });

  factory SyncAnimal.fromJson(Map<String, dynamic> json) {
    return SyncAnimal(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      tagNumber: json['tagNumber'] as String,
      rfidNumber: json['rfidNumber'] as String?,
      name: json['name'] as String?,
      species: json['species'] as String,
      breed: json['breed'] as String?,
      gender: json['gender'] as String,
      dateOfBirth: json['dateOfBirth'] as String?,
      weightKg: (json['weightKg'] as num?)?.toDouble(),
      status: json['status'] as String,
      sireId: json['sireId'] as String?,
      damId: json['damId'] as String?,
      metadata: json['metadata'] != null
          ? Map<String, dynamic>.from(json['metadata'] as Map)
          : null,
      syncVersion: json['syncVersion'] as int? ?? 1,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
      deletedAt: json['deletedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farmId': farmId,
      'tagNumber': tagNumber,
      'rfidNumber': rfidNumber,
      'name': name,
      'species': species,
      'breed': breed,
      'gender': gender,
      'dateOfBirth': dateOfBirth,
      'weightKg': weightKg,
      'status': status,
      'sireId': sireId,
      'damId': damId,
      'metadata': metadata,
      'syncVersion': syncVersion,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'deletedAt': deletedAt,
    };
  }

  Map<String, dynamic> toDbMap({int isSynced = 1}) {
    return {
      'id': id,
      'farm_id': farmId,
      'tag_number': tagNumber,
      'rfid_number': rfidNumber,
      'name': name,
      'species': species,
      'breed': breed,
      'gender': gender,
      'date_of_birth': dateOfBirth,
      'weight_kg': weightKg,
      'status': status,
      'sire_id': sireId,
      'dam_id': damId,
      'metadata': metadata != null ? jsonEncode(metadata) : null,
      'sync_version': syncVersion,
      'created_at': createdAt,
      'updated_at': updatedAt,
      'deleted_at': deletedAt,
      'is_synced': isSynced,
    };
  }

  factory SyncAnimal.fromDbMap(Map<String, dynamic> map) {
    return SyncAnimal(
      id: map['id'] as String,
      farmId: map['farm_id'] as String,
      tagNumber: map['tag_number'] as String,
      rfidNumber: map['rfid_number'] as String?,
      name: map['name'] as String?,
      species: map['species'] as String,
      breed: map['breed'] as String?,
      gender: map['gender'] as String,
      dateOfBirth: map['date_of_birth'] as String?,
      weightKg: (map['weight_kg'] as num?)?.toDouble(),
      status: map['status'] as String,
      sireId: map['sire_id'] as String?,
      damId: map['dam_id'] as String?,
      metadata: map['metadata'] != null
          ? Map<String, dynamic>.from(jsonDecode(map['metadata'] as String))
          : null,
      syncVersion: map['sync_version'] as int? ?? 1,
      createdAt: map['created_at'] as String,
      updatedAt: map['updated_at'] as String,
      deletedAt: map['deleted_at'] as String?,
    );
  }
}

class SyncMilkLog {
  final String id;
  final String farmId;
  final String? animalId;
  final String recordedById;
  final String session;
  final double yieldLiters;
  final double? fatPercent;
  final double? snfPercent;
  final String loggedDate;
  final int syncVersion;
  final String createdAt;
  final String updatedAt;

  SyncMilkLog({
    required this.id,
    required this.farmId,
    this.animalId,
    required this.recordedById,
    required this.session,
    required this.yieldLiters,
    this.fatPercent,
    this.snfPercent,
    required this.loggedDate,
    required this.syncVersion,
    required this.createdAt,
    required this.updatedAt,
  });

  factory SyncMilkLog.fromJson(Map<String, dynamic> json) {
    return SyncMilkLog(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      animalId: json['animalId'] as String?,
      recordedById: json['recordedById'] as String,
      session: json['session'] as String,
      yieldLiters: (json['yieldLiters'] as num).toDouble(),
      fatPercent: (json['fatPercent'] as num?)?.toDouble(),
      snfPercent: (json['snfPercent'] as num?)?.toDouble(),
      loggedDate: json['loggedDate'] as String,
      syncVersion: json['syncVersion'] as int? ?? 1,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farmId': farmId,
      'animalId': animalId,
      'recordedById': recordedById,
      'session': session,
      'yieldLiters': yieldLiters,
      'fatPercent': fatPercent,
      'snfPercent': snfPercent,
      'loggedDate': loggedDate,
      'syncVersion': syncVersion,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }

  Map<String, dynamic> toDbMap({int isSynced = 1}) {
    return {
      'id': id,
      'farm_id': farmId,
      'animal_id': animalId,
      'recorded_by_id': recordedById,
      'session': session,
      'yield_liters': yieldLiters,
      'fat_percent': fatPercent,
      'snf_percent': snfPercent,
      'logged_date': loggedDate,
      'sync_version': syncVersion,
      'created_at': createdAt,
      'updated_at': updatedAt,
      'is_synced': isSynced,
    };
  }

  factory SyncMilkLog.fromDbMap(Map<String, dynamic> map) {
    return SyncMilkLog(
      id: map['id'] as String,
      farmId: map['farm_id'] as String,
      animalId: map['animal_id'] as String?,
      recordedById: map['recorded_by_id'] as String,
      session: map['session'] as String,
      yieldLiters: (map['yield_liters'] as num).toDouble(),
      fatPercent: (map['fat_percent'] as num?)?.toDouble(),
      snfPercent: (map['snf_percent'] as num?)?.toDouble(),
      loggedDate: map['logged_date'] as String,
      syncVersion: map['sync_version'] as int? ?? 1,
      createdAt: map['created_at'] as String,
      updatedAt: map['updated_at'] as String,
    );
  }
}

class SyncHealthRecord {
  final String id;
  final String farmId;
  final String animalId;
  final String recordedById;
  final String? attendingVetId;
  final String eventType;
  final String severity;
  final String symptoms;
  final String? diagnosis;
  final String? treatment;
  final double cost;
  final String? resolvedAt;
  final int syncVersion;
  final String createdAt;
  final String updatedAt;

  SyncHealthRecord({
    required this.id,
    required this.farmId,
    required this.animalId,
    required this.recordedById,
    this.attendingVetId,
    required this.eventType,
    required this.severity,
    required this.symptoms,
    this.diagnosis,
    this.treatment,
    required this.cost,
    this.resolvedAt,
    required this.syncVersion,
    required this.createdAt,
    required this.updatedAt,
  });

  factory SyncHealthRecord.fromJson(Map<String, dynamic> json) {
    return SyncHealthRecord(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      animalId: json['animalId'] as String,
      recordedById: json['recordedById'] as String,
      attendingVetId: json['attendingVetId'] as String?,
      eventType: json['eventType'] as String,
      severity: json['severity'] as String,
      symptoms: json['symptoms'] as String,
      diagnosis: json['diagnosis'] as String?,
      treatment: json['treatment'] as String?,
      cost: (json['cost'] as num?)?.toDouble() ?? 0.0,
      resolvedAt: json['resolvedAt'] as String?,
      syncVersion: json['syncVersion'] as int? ?? 1,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farmId': farmId,
      'animalId': animalId,
      'recordedById': recordedById,
      'attendingVetId': attendingVetId,
      'eventType': eventType,
      'severity': severity,
      'symptoms': symptoms,
      'diagnosis': diagnosis,
      'treatment': treatment,
      'cost': cost,
      'resolvedAt': resolvedAt,
      'syncVersion': syncVersion,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }

  Map<String, dynamic> toDbMap({int isSynced = 1}) {
    return {
      'id': id,
      'farm_id': farmId,
      'animal_id': animalId,
      'recorded_by_id': recordedById,
      'attending_vet_id': attendingVetId,
      'event_type': eventType,
      'severity': severity,
      'symptoms': symptoms,
      'diagnosis': diagnosis,
      'treatment': treatment,
      'cost': cost,
      'resolved_at': resolvedAt,
      'sync_version': syncVersion,
      'created_at': createdAt,
      'updated_at': updatedAt,
      'is_synced': isSynced,
    };
  }

  factory SyncHealthRecord.fromDbMap(Map<String, dynamic> map) {
    return SyncHealthRecord(
      id: map['id'] as String,
      farmId: map['farm_id'] as String,
      animalId: map['animal_id'] as String,
      recordedById: map['recorded_by_id'] as String,
      attendingVetId: map['attending_vet_id'] as String?,
      eventType: map['event_type'] as String,
      severity: map['severity'] as String,
      symptoms: map['symptoms'] as String,
      diagnosis: map['diagnosis'] as String?,
      treatment: map['treatment'] as String?,
      cost: (map['cost'] as num?)?.toDouble() ?? 0.0,
      resolvedAt: map['resolved_at'] as String?,
      syncVersion: map['sync_version'] as int? ?? 1,
      createdAt: map['created_at'] as String,
      updatedAt: map['updated_at'] as String,
    );
  }
}

class SyncVaccineRecord {
  final String id;
  final String farmId;
  final String animalId;
  final String administeredBy;
  final String recordType;
  final String vaccineName;
  final String? batchNumber;
  final double doseAmount;
  final String doseUnit;
  final double cost;
  final String? notes;
  final String administeredAt;
  final String? nextDueDate;
  final int syncVersion;
  final String createdAt;
  final String updatedAt;

  SyncVaccineRecord({
    required this.id,
    required this.farmId,
    required this.animalId,
    required this.administeredBy,
    required this.recordType,
    required this.vaccineName,
    this.batchNumber,
    required this.doseAmount,
    required this.doseUnit,
    required this.cost,
    this.notes,
    required this.administeredAt,
    this.nextDueDate,
    required this.syncVersion,
    required this.createdAt,
    required this.updatedAt,
  });

  factory SyncVaccineRecord.fromJson(Map<String, dynamic> json) {
    return SyncVaccineRecord(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      animalId: json['animalId'] as String,
      administeredBy: json['administeredBy'] as String,
      recordType: json['recordType'] as String,
      vaccineName: json['vaccineName'] as String,
      batchNumber: json['batchNumber'] as String?,
      doseAmount: (json['doseAmount'] as num).toDouble(),
      doseUnit: json['doseUnit'] as String? ?? 'ml',
      cost: (json['cost'] as num?)?.toDouble() ?? 0.0,
      notes: json['notes'] as String?,
      administeredAt: json['administeredAt'] as String,
      nextDueDate: json['nextDueDate'] as String?,
      syncVersion: json['syncVersion'] as int? ?? 1,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farmId': farmId,
      'animalId': animalId,
      'administeredBy': administeredBy,
      'recordType': recordType,
      'vaccineName': vaccineName,
      'batchNumber': batchNumber,
      'doseAmount': doseAmount,
      'doseUnit': doseUnit,
      'cost': cost,
      'notes': notes,
      'administeredAt': administeredAt,
      'nextDueDate': nextDueDate,
      'syncVersion': syncVersion,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }

  Map<String, dynamic> toDbMap({int isSynced = 1}) {
    return {
      'id': id,
      'farm_id': farmId,
      'animal_id': animalId,
      'administered_by_id': administeredBy,
      'record_type': recordType,
      'vaccine_name': vaccineName,
      'batch_number': batchNumber,
      'dose_amount': doseAmount,
      'dose_unit': doseUnit,
      'cost': cost,
      'notes': notes,
      'administered_at': administeredAt,
      'next_due_date': nextDueDate,
      'sync_version': syncVersion,
      'created_at': createdAt,
      'updated_at': updatedAt,
      'is_synced': isSynced,
    };
  }

  factory SyncVaccineRecord.fromDbMap(Map<String, dynamic> map) {
    return SyncVaccineRecord(
      id: map['id'] as String,
      farmId: map['farm_id'] as String,
      animalId: map['animal_id'] as String,
      administeredBy: map['administered_by_id'] as String,
      recordType: map['record_type'] as String,
      vaccineName: map['vaccine_name'] as String,
      batchNumber: map['batch_number'] as String?,
      doseAmount: (map['dose_amount'] as num).toDouble(),
      doseUnit: map['dose_unit'] as String? ?? 'ml',
      cost: (map['cost'] as num?)?.toDouble() ?? 0.0,
      notes: map['notes'] as String?,
      administeredAt: map['administered_at'] as String,
      nextDueDate: map['next_due_date'] as String?,
      syncVersion: map['sync_version'] as int? ?? 1,
      createdAt: map['created_at'] as String,
      updatedAt: map['updated_at'] as String,
    );
  }
}

class SyncWeightLog {
  final String id;
  final String farmId;
  final String animalId;
  final String recordedById;
  final double weightKg;
  final String recordedAt;
  final String? notes;
  final int syncVersion;
  final String createdAt;
  final String updatedAt;

  SyncWeightLog({
    required this.id,
    required this.farmId,
    required this.animalId,
    required this.recordedById,
    required this.weightKg,
    required this.recordedAt,
    this.notes,
    required this.syncVersion,
    required this.createdAt,
    required this.updatedAt,
  });

  factory SyncWeightLog.fromJson(Map<String, dynamic> json) {
    return SyncWeightLog(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      animalId: json['animalId'] as String,
      recordedById: json['recordedById'] as String,
      weightKg: (json['weightKg'] as num).toDouble(),
      recordedAt: json['recordedAt'] as String,
      notes: json['notes'] as String?,
      syncVersion: json['syncVersion'] as int? ?? 1,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farmId': farmId,
      'animalId': animalId,
      'recordedById': recordedById,
      'weightKg': weightKg,
      'recordedAt': recordedAt,
      'notes': notes,
      'syncVersion': syncVersion,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }

  Map<String, dynamic> toDbMap({int isSynced = 1}) {
    return {
      'id': id,
      'farm_id': farmId,
      'animal_id': animalId,
      'recorded_by_id': recordedById,
      'weight_kg': weightKg,
      'recorded_at': recordedAt,
      'notes': notes,
      'sync_version': syncVersion,
      'created_at': createdAt,
      'updated_at': updatedAt,
      'is_synced': isSynced,
    };
  }

  factory SyncWeightLog.fromDbMap(Map<String, dynamic> map) {
    return SyncWeightLog(
      id: map['id'] as String,
      farmId: map['farm_id'] as String,
      animalId: map['animal_id'] as String,
      recordedById: map['recorded_by_id'] as String,
      weightKg: (map['weight_kg'] as num).toDouble(),
      recordedAt: map['recorded_at'] as String,
      notes: map['notes'] as String?,
      syncVersion: map['sync_version'] as int? ?? 1,
      createdAt: map['created_at'] as String,
      updatedAt: map['updated_at'] as String,
    );
  }
}

class SyncTransaction {
  final String id;
  final String farmId;
  final String recordedById;
  final String? animalId;
  final String type;
  final String category;
  final double amount;
  final String currency;
  final String? referenceNote;
  final String? receiptUrl;
  final String txDate;
  final int syncVersion;
  final String createdAt;
  final String updatedAt;
  final String? deletedAt;

  SyncTransaction({
    required this.id,
    required this.farmId,
    required this.recordedById,
    this.animalId,
    required this.type,
    required this.category,
    required this.amount,
    required this.currency,
    this.referenceNote,
    this.receiptUrl,
    required this.txDate,
    required this.syncVersion,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
  });

  factory SyncTransaction.fromJson(Map<String, dynamic> json) {
    return SyncTransaction(
      id: json['id'] as String,
      farmId: json['farmId'] as String,
      recordedById: json['recordedById'] as String,
      animalId: json['animalId'] as String?,
      type: json['type'] as String,
      category: json['category'] as String,
      amount: (json['amount'] as num).toDouble(),
      currency: json['currency'] as String? ?? 'USD',
      referenceNote: json['referenceNote'] as String?,
      receiptUrl: json['receiptUrl'] as String?,
      txDate: json['txDate'] as String,
      syncVersion: json['syncVersion'] as int? ?? 1,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
      deletedAt: json['deletedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'farmId': farmId,
      'recordedById': recordedById,
      'animalId': animalId,
      'type': type,
      'category': category,
      'amount': amount,
      'currency': currency,
      'referenceNote': referenceNote,
      'receiptUrl': receiptUrl,
      'txDate': txDate,
      'syncVersion': syncVersion,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
      'deletedAt': deletedAt,
    };
  }

  Map<String, dynamic> toDbMap({int isSynced = 1}) {
    return {
      'id': id,
      'farm_id': farmId,
      'recorded_by_id': recordedById,
      'animal_id': animalId,
      'type': type,
      'category': category,
      'amount': amount,
      'currency': currency,
      'reference_note': referenceNote,
      'receipt_url': receiptUrl,
      'transaction_date': txDate,
      'sync_version': syncVersion,
      'created_at': createdAt,
      'updated_at': updatedAt,
      'deleted_at': deletedAt,
      'is_synced': isSynced,
    };
  }

  factory SyncTransaction.fromDbMap(Map<String, dynamic> map) {
    return SyncTransaction(
      id: map['id'] as String,
      farmId: map['farm_id'] as String,
      recordedById: map['recorded_by_id'] as String,
      animalId: map['animal_id'] as String?,
      type: map['type'] as String,
      category: map['category'] as String,
      amount: (map['amount'] as num).toDouble(),
      currency: map['currency'] as String? ?? 'USD',
      referenceNote: map['reference_note'] as String?,
      receiptUrl: map['receipt_url'] as String?,
      txDate: map['transaction_date'] as String,
      syncVersion: map['sync_version'] as int? ?? 1,
      createdAt: map['created_at'] as String,
      updatedAt: map['updated_at'] as String,
      deletedAt: map['deleted_at'] as String?,
    );
  }
}

// ==========================================
// Sync Protocol DTOs
// ==========================================

class SyncTableChanges<T> {
  final List<T> created;
  final List<T> updated;
  final List<String> deleted;

  SyncTableChanges({
    required this.created,
    required this.updated,
    required this.deleted,
  });

  factory SyncTableChanges.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJsonT,
  ) {
    return SyncTableChanges<T>(
      created: (json['created'] as List<dynamic>? ?? [])
          .map((e) => fromJsonT(e as Map<String, dynamic>))
          .toList(),
      updated: (json['updated'] as List<dynamic>? ?? [])
          .map((e) => fromJsonT(e as Map<String, dynamic>))
          .toList(),
      deleted: (json['deleted'] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .toList(),
    );
  }

  Map<String, dynamic> toJson(Map<String, dynamic> Function(T) toJsonT) {
    return {
      'created': created.map(toJsonT).toList(),
      'updated': updated.map(toJsonT).toList(),
      'deleted': deleted,
    };
  }
}

class SyncPullRequest {
  final String farmId;
  final int? lastPulledAt;

  SyncPullRequest({required this.farmId, this.lastPulledAt});

  Map<String, dynamic> toJson() {
    return {
      'farmId': farmId,
      'lastPulledAt': lastPulledAt,
    };
  }
}

class SyncPullResponse {
  final String farmId;
  final int serverTimestamp;
  final SyncTableChanges<SyncAnimal> animals;
  final SyncTableChanges<SyncMilkLog> milkLogs;
  final SyncTableChanges<SyncHealthRecord> healthRecords;
  final SyncTableChanges<SyncVaccineRecord> vaccineRecords;
  final SyncTableChanges<SyncWeightLog> weightLogs;
  final SyncTableChanges<SyncTransaction> transactions;

  SyncPullResponse({
    required this.farmId,
    required this.serverTimestamp,
    required this.animals,
    required this.milkLogs,
    required this.healthRecords,
    required this.vaccineRecords,
    required this.weightLogs,
    required this.transactions,
  });

  factory SyncPullResponse.fromJson(Map<String, dynamic> json) {
    final changes = json['changes'] as Map<String, dynamic>? ?? {};

    return SyncPullResponse(
      farmId: json['farmId'] as String,
      serverTimestamp: json['serverTimestamp'] as int,
      animals: SyncTableChanges.fromJson(
        changes['animals'] as Map<String, dynamic>? ?? {},
        SyncAnimal.fromJson,
      ),
      milkLogs: SyncTableChanges.fromJson(
        changes['milkLogs'] as Map<String, dynamic>? ?? {},
        SyncMilkLog.fromJson,
      ),
      healthRecords: SyncTableChanges.fromJson(
        changes['healthRecords'] as Map<String, dynamic>? ?? {},
        SyncHealthRecord.fromJson,
      ),
      vaccineRecords: SyncTableChanges.fromJson(
        changes['vaccineRecords'] as Map<String, dynamic>? ?? {},
        SyncVaccineRecord.fromJson,
      ),
      weightLogs: SyncTableChanges.fromJson(
        changes['weightLogs'] as Map<String, dynamic>? ?? {},
        SyncWeightLog.fromJson,
      ),
      transactions: SyncTableChanges.fromJson(
        changes['transactions'] as Map<String, dynamic>? ?? {},
        SyncTransaction.fromJson,
      ),
    );
  }
}

class SyncConflictItem {
  final String table;
  final String recordId;
  final String reason;
  final SyncConflictResolution resolution;
  final int? serverVersion;
  final int? clientVersion;

  SyncConflictItem({
    required this.table,
    required this.recordId,
    required this.reason,
    required this.resolution,
    this.serverVersion,
    this.clientVersion,
  });

  factory SyncConflictItem.fromJson(Map<String, dynamic> json) {
    return SyncConflictItem(
      table: json['table'] as String,
      recordId: json['recordId'] as String,
      reason: json['reason'] as String,
      resolution: json['resolution'] == 'CLIENT_APPLIED'
          ? SyncConflictResolution.clientApplied
          : SyncConflictResolution.serverWins,
      serverVersion: json['serverVersion'] as int?,
      clientVersion: json['clientVersion'] as int?,
    );
  }
}

class SyncPushResponse {
  final bool success;
  final int serverTimestamp;
  final Map<String, int> appliedCounts;
  final List<SyncConflictItem> conflicts;

  SyncPushResponse({
    required this.success,
    required this.serverTimestamp,
    required this.appliedCounts,
    required this.conflicts,
  });

  factory SyncPushResponse.fromJson(Map<String, dynamic> json) {
    return SyncPushResponse(
      success: json['success'] as bool? ?? false,
      serverTimestamp: json['serverTimestamp'] as int? ?? DateTime.now().millisecondsSinceEpoch,
      appliedCounts: json['appliedCounts'] != null
          ? Map<String, int>.from(json['appliedCounts'] as Map)
          : {},
      conflicts: (json['conflicts'] as List<dynamic>? ?? [])
          .map((e) => SyncConflictItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
