CREATE TABLE IF NOT EXISTS files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    file_name       TEXT    UNIQUE
                               NOT NULL,
    time_modified   INTEGER NOT NULL,
    size_kb         INTEGER NOT NULL,
    time_last_check INTEGER NOT NULL
);


CREATE TABLE IF NOT EXISTS text_boxs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    number_block  INTEGER NOT NULL,
    text          TEXT,
    file_id       INTEGER NOT NULL
                        REFERENCES files (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS items (
    value       TEXT    NOT NULL,
    text_box_id INTEGER REFERENCES text_boxs (id) ON DELETE CASCADE
                          NOT NULL,
    start       INTEGER    NOT NULL,
    end         INTEGER    NOT NULL
);


CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(text, content=text_boxs, content_rowid=id);

CREATE TRIGGER IF NOT EXISTS text_boxs_insert AFTER INSERT ON text_boxs 
BEGIN
  INSERT INTO fts(rowid, text) VALUES (new.id, new.text);
END;

CREATE TRIGGER IF NOT EXISTS text_boxs_delete AFTER DELETE ON text_boxs 
BEGIN
  INSERT INTO fts(fts, rowid, text) VALUES('delete', old.id, old.text);
END;


CREATE INDEX IF NOT EXISTS idx_files ON files (file_name);
