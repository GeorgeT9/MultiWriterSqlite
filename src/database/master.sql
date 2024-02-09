CREATE TABLE IF NOT EXISTS parts (
    id NUMERIC PRIMARY KEY AUTOINCREMENT
             NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id       NUMERIC PRIMARY KEY AUTOINCREMENT,
    fileName TEXT    UNIQUE
                     NOT NULL,
    mTimeMs  NUMERIC NOT NULL,
    sizeKb   INTEGER NOT NULL,
    partId   INTEGER NOT NULL
                     REFERENCES parts (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS handlers (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT    UNIQUE
                     NOT NULL,
    rgx      TEXT    NOT NULL,
    postFunc TEXT
);
