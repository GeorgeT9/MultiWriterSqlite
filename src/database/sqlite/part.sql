CREATE TABLE IF NOT EXISTS text_boxs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    numberLine INTEGER NOT NULL,
    text       TEXT,
    fileId     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS [values] (
    value     TEXT    NOT NULL,
    textBoxId INTEGER REFERENCES text_boxs (id) ON DELETE CASCADE
                      NOT NULL,
    position  TEXT    NOT NULL
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
