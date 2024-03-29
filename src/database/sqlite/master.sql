CREATE TABLE IF NOT EXISTS parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    created NUMERIC DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS files (
    id       INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    fileName TEXT    UNIQUE
                     NOT NULL,
    mTimeMs  NUMERIC NOT NULL,
    sizeKb   INTEGER NOT NULL,
    partId   INTEGER NOT NULL
                     REFERENCES parts (id) ON DELETE CASCADE,
    checkTimeMs NUMERIC NOT NULL
)


create index if not exists idx_files
on files (fileName);
