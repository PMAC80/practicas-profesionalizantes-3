BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "access" (
	"id_group"	INTEGER NOT NULL,
	"id_endpoint"	INTEGER NOT NULL,
	PRIMARY KEY("id_group","id_endpoint"),
	FOREIGN KEY("id_endpoint") REFERENCES "endpoint"("id"),
	FOREIGN KEY("id_group") REFERENCES "group"("id")
);
CREATE TABLE IF NOT EXISTS "endpoint" (
	"id"	INTEGER,
	"path"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "group" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "members" (
	"id_user"	INTEGER NOT NULL,
	"id_group"	INTEGER NOT NULL,
	PRIMARY KEY("id_user","id_group"),
	FOREIGN KEY("id_group") REFERENCES "group"("id"),
	FOREIGN KEY("id_user") REFERENCES "user"("id")
);
CREATE TABLE IF NOT EXISTS "user" (
	"id"	INTEGER NOT NULL,
	"username"	TEXT NOT NULL,
	"password"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
INSERT INTO "user" VALUES (1,'usuario_demo','password123');
INSERT INTO "user" VALUES (2,'usuario_demo','password123');
INSERT INTO "user" VALUES (3,'usuario_demo','password123');
INSERT INTO "user" VALUES (4,'usuario_demo','password123');
INSERT INTO "user" VALUES (5,'test','123456789');
INSERT INTO "user" VALUES (6,'test','123456789');
COMMIT;
