# VETRALINK PRO — Comprehensive Docker & Local Infrastructure Guide
# Audience: Developers new to Docker & Containerization
# Last Updated: 2026-09-05

---

## 1. What is Docker & Why Do We Use It?

### 1.1 The Problem It Solves
When building complex platforms like VETRALINK PRO, the application requires several backend services to run:
- **PostgreSQL 16**: The relational database storing multi-tenant farm data, livestock records, EHR, and billing.
- **Redis 7**: The in-memory data store used for fast caching, rate limiting, and BullMQ background job queues.
- **MinIO**: A high-performance, S3-compatible local object storage server simulating AWS S3 / Cloudflare R2 for storing video courses, PDFs, and prescriptions.

Without Docker, every developer would have to manually install PostgreSQL, configure local users, install Redis, install MinIO, and fight with port conflicts and Windows service settings.

### 1.2 How Docker Works
- **Image**: A frozen snapshot of a software environment (e.g., `postgres:16-alpine`, `redis:7-alpine`). Think of this as a recipe or template.
- **Container**: A running instance created from an image. It is an isolated, lightweight sandbox that behaves like a mini-server on your machine.
- **Volume**: Persistent storage on your hard drive that survives when containers stop or restart. Your database tables and data are safely saved here.
- **Docker Compose**: A tool that coordinates multi-container applications using a single YAML configuration file (`infrastructure/docker-compose.yml`). With one command, it creates the network, mounts the storage volumes, and starts all 3 services.

---

## 2. Our Local Infrastructure Architecture

```
                                  +---------------------------------------+
                                  |         Windows 11 Host               |
                                  |  (Docker Desktop + WSL2 on Drive G:)  |
                                  +-------------------+-------------------+
                                                      |
                                          infrastructure_vetralink-network
                                                      |
                 +------------------------------------+-----------------------------------+
                 |                                    |                                   |
                 v                                    v                                   v
    +-------------------------+          +-------------------------+          +-------------------------+
    |   vetralink-postgres    |          |     vetralink-redis     |          |     vetralink-minio     |
    |   PostgreSQL 16 Engine  |          |      Redis 7 Engine     |          |    S3 Object Storage    |
    +-------------------------+          +-------------------------+          +-------------------------+
    | Host Port: 5432         |          | Host Port: 6379         |          | API Port: 9000          |
    | Volume: postgres_data   |          | Volume: redis_data      |          | Console Port: 9001      |
    | User: vetralink         |          | Password: dev pass      |          | User: vetralink_minio   |
    | DB: vetralink_dev       |          +-------------------------+          +-------------------------+
    +-------------------------+
```

### Storage Location on Your Machine
All virtual disks and container volumes reside on your high-capacity drive:
- **VHDX Virtual Disk**: `G:\Docker\wsl\disk\docker_data.vhdx`
- **WSL System Disk**: `G:\Docker\wsl\main\ext4.vhdx`
- **Windows Junction**: `C:\Users\asus\AppData\Local\Docker\wsl` points directly to `G:\Docker\wsl`.

> [!WARNING]
> **Never delete** the folder `C:\Users\asus\AppData\Local\Docker\wsl` in Windows Explorer. It is an NTFS Directory Junction linked to `G:\Docker\wsl`. Deleting it will delete your Docker data on `G:`.

---

## 3. Daily Developer Workflow Cheatsheet

### 3.1 Prerequisite: Ensure Docker Desktop is Running
Docker commands on Windows communicate via a named pipe that only exists when **Docker Desktop** is open.
1. Launch **Docker Desktop** from your Windows Start Menu.
2. Verify the whale icon in the Windows taskbar tray (bottom-right) is steady green with status **"Engine running"**.

---

### 3.2 Starting the Infrastructure
Navigate to the project root (`G:\projucts\veterinary`) in Git Bash or PowerShell and run:

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```
- `-f infrastructure/docker-compose.yml`: Tells Docker Compose which config file to use.
- `up`: Builds, creates, and starts the containers.
- `-d` (detached mode): Runs the containers in the background so your terminal remains free.

---

### 3.3 Checking Container Status
To check if the containers are running and healthy:

```bash
docker compose -f infrastructure/docker-compose.yml ps
```
You should see:
```text
NAME                 IMAGE                COMMAND                  SERVICE    STATUS
vetralink-minio      minio/minio:...      "/usr/bin/docker-ent…"   minio      Up (healthy)
vetralink-postgres   postgres:16-alpine   "docker-entrypoint.s…"   postgres   Up (healthy)
vetralink-redis      redis:7-alpine       "docker-entrypoint.s…"   redis      Up (healthy)
```

---

### 3.4 Viewing Real-time Service Logs
If you want to inspect database queries or check Redis logs:

```bash
# View all logs together
docker compose -f infrastructure/docker-compose.yml logs -f

# View only PostgreSQL logs
docker compose -f infrastructure/docker-compose.yml logs -f postgres

# View only Redis logs
docker compose -f infrastructure/docker-compose.yml logs -f redis
```
*(Press `Ctrl + C` to exit the log stream).*

---

### 3.5 Stopping the Infrastructure (End of Workday)
When you are done developing for the day and want to free up RAM/CPU:

```bash
# Pause/Stop containers without deleting anything
docker compose -f infrastructure/docker-compose.yml stop
```
To start them back up the next morning:
```bash
docker compose -f infrastructure/docker-compose.yml start
```

---

### 3.6 Tearing Down Containers (Safe vs. Reset)

#### Safe Teardown (Keeps all database tables & data intact):
```bash
docker compose -f infrastructure/docker-compose.yml down
```
This stops and removes the container runtime, but **keeps your volumes safe**. When you run `up -d` again, all your database records will still be there!

#### Factory Reset (Wipes all database data to clean state):
```bash
docker compose -f infrastructure/docker-compose.yml down -v
```
> [!CAUTION]
> The `-v` flag removes volumes. Only run this if you intentionally want to delete all local database records and start from a fresh migration!

---

## 4. Useful Direct Access & Debugging Commands

### 4.1 Accessing the PostgreSQL Terminal (`psql`)
You can jump directly into the running database container without installing PostgreSQL locally:

```bash
docker exec -it vetralink-postgres psql -U vetralink -d vetralink_dev
```
Inside `psql`, useful commands:
- `\dt`: List all tables.
- `\d users`: Inspect table schema and indexes for `users`.
- `SELECT * FROM users;`: Query table data.
- `\q`: Quit `psql`.

---

### 4.2 Accessing the Redis CLI (`redis-cli`)
Connect directly to the in-memory Redis instance:

```bash
docker exec -it vetralink-redis redis-cli -a redis_secret_dev_pass
```
Inside `redis-cli`, useful commands:
- `ping`: Returns `PONG`.
- `keys *`: List all cached keys.
- `info`: Display memory usage and connected clients.
- `quit`: Exit CLI.

---

### 4.3 MinIO S3 Web Console
MinIO provides a visual web dashboard to view S3 storage buckets:
- **URL**: [http://localhost:9001](http://localhost:9001)
- **Username**: `vetralink_minio`
- **Password**: `minio_secret_dev_pass`
- Here you can create buckets, view uploaded video chunks, or inspect generated PDF prescriptions.

---

## 5. Troubleshooting Common Issues

| Issue / Error | Cause | Solution |
| :--- | :--- | :--- |
| `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified` | Docker Desktop is not running. | Open Docker Desktop from the Start Menu and wait for the whale icon to turn steady green. |
| `Bind for 0.0.0.0:5432 failed: port is already allocated` | Another local PostgreSQL instance is running on Windows port 5432. | Stop the Windows local service: Open `services.msc`, find `postgresql-x64-16`, right-click and choose **Stop**. Or change `POSTGRES_PORT=5433` in `.env`. |
| `Bind for 0.0.0.0:6379 failed: port is already allocated` | Another local Redis server or background process is running on 6379. | Stop the local Redis process using Windows Task Manager or run `Get-Process *redis* \| Stop-Process`. |
| Database migration fails with `Connection refused` | Containers were just started and PostgreSQL is still initializing. | Wait 5 seconds for the healthcheck to pass, then re-run `pnpm --filter @vetralink/api db:deploy`. |
| Running out of C: drive disk space | Docker data was originally on C:. | Already solved! Your storage has been relocated to `G:\Docker\wsl\disk\docker_data.vhdx`. |
