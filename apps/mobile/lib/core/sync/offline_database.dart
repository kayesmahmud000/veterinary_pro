import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class OfflineDatabase {
  static final OfflineDatabase instance = OfflineDatabase._internal();
  static Database? _database;

  OfflineDatabase._internal();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'vetralink_offline.db');

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDb,
    );
  }

  Future<void> _createDb(Database db, int version) async {
    // 1. Animals
    await db.execute('''
      CREATE TABLE animals (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL,
        tag_number TEXT NOT NULL,
        rfid_number TEXT,
        name TEXT,
        species TEXT NOT NULL,
        breed TEXT,
        gender TEXT NOT NULL,
        date_of_birth TEXT,
        weight_kg REAL,
        status TEXT NOT NULL,
        sire_id TEXT,
        dam_id TEXT,
        metadata TEXT,
        sync_version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        is_synced INTEGER DEFAULT 1
      )
    ''');
    await db.execute('CREATE INDEX idx_animals_farm_tag ON animals(farm_id, tag_number)');

    // 2. Milk Logs
    await db.execute('''
      CREATE TABLE milk_logs (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL,
        animal_id TEXT,
        recorded_by_id TEXT NOT NULL,
        session TEXT NOT NULL,
        yield_liters REAL NOT NULL,
        fat_percent REAL,
        snf_percent REAL,
        logged_date TEXT NOT NULL,
        sync_version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_synced INTEGER DEFAULT 1
      )
    ''');
    await db.execute('CREATE INDEX idx_milk_logs_farm_date ON milk_logs(farm_id, logged_date)');

    // 3. Health Records
    await db.execute('''
      CREATE TABLE health_records (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL,
        animal_id TEXT NOT NULL,
        recorded_by_id TEXT NOT NULL,
        attending_vet_id TEXT,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        symptoms TEXT NOT NULL,
        diagnosis TEXT,
        treatment TEXT,
        cost REAL DEFAULT 0,
        resolved_at TEXT,
        sync_version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_synced INTEGER DEFAULT 1
      )
    ''');
    await db.execute('CREATE INDEX idx_health_records_animal ON health_records(animal_id)');

    // 4. Vaccine Records
    await db.execute('''
      CREATE TABLE vaccine_records (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL,
        animal_id TEXT NOT NULL,
        administered_by_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        vaccine_name TEXT NOT NULL,
        batch_number TEXT,
        dose_amount REAL NOT NULL,
        dose_unit TEXT DEFAULT 'ml',
        cost REAL DEFAULT 0,
        notes TEXT,
        administered_at TEXT NOT NULL,
        next_due_date TEXT,
        sync_version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_synced INTEGER DEFAULT 1
      )
    ''');
    await db.execute('CREATE INDEX idx_vaccine_records_due ON vaccine_records(farm_id, next_due_date)');

    // 5. Weight Logs
    await db.execute('''
      CREATE TABLE animal_weight_logs (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL,
        animal_id TEXT NOT NULL,
        recorded_by_id TEXT NOT NULL,
        weight_kg REAL NOT NULL,
        recorded_at TEXT NOT NULL,
        notes TEXT,
        sync_version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_synced INTEGER DEFAULT 1
      )
    ''');
    await db.execute('CREATE INDEX idx_weight_logs_animal ON animal_weight_logs(animal_id)');

    // 6. Farm Transactions
    await db.execute('''
      CREATE TABLE farm_transactions (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL,
        recorded_by_id TEXT NOT NULL,
        animal_id TEXT,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        reference_note TEXT,
        receipt_url TEXT,
        transaction_date TEXT NOT NULL,
        sync_version INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        is_synced INTEGER DEFAULT 1
      )
    ''');
    await db.execute('CREATE INDEX idx_transactions_farm_date ON farm_transactions(farm_id, transaction_date)');

    // 7. Sync Queue
    await db.execute('''
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        farm_id TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    ''');
    await db.execute('CREATE INDEX idx_sync_queue_farm ON sync_queue(farm_id)');

    // 8. Sync Metadata
    await db.execute('''
      CREATE TABLE sync_metadata (
        farm_id TEXT PRIMARY KEY,
        last_pulled_at INTEGER,
        last_pushed_at INTEGER,
        status TEXT,
        updated_at TEXT NOT NULL
      )
    ''');
  }

  Future<void> close() async {
    final db = _database;
    if (db != null) {
      await db.close();
      _database = null;
    }
  }
}
