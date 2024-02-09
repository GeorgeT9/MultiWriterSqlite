-- таблица с id items_#
CREATE TABLE IF NOT EXISTS parts (
    id NUMERIC PRIMARY KEY AUTOINCREMENT
             NOT NULL
);

-- таблица с именами файлов
CREATE TABLE IF NOT EXISTS files (
    id       NUMERIC PRIMARY KEY AUTOINCREMENT,
    fileName TEXT    UNIQUE
                     NOT NULL,
    mTimeMs  NUMERIC NOT NULL,
    sizeKb   INTEGER NOT NULL,
    partId   INTEGER NOT NULL
                     REFERENCES parts (id) ON DELETE CASCADE
);

-- таблица с данными для создания обработчиков
CREATE TABLE IF NOT EXISTS handlers (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT    UNIQUE
                     NOT NULL,
    rgx      TEXT    NOT NULL,
    postFunc TEXT
);




-- Создание отдельной БД part_#
CREATE TABLE IF NOT EXISTS text_boxs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE VIRTUAL TABLE fts USING fts5(text, content=text_boxs, content_rowid=id);

CREATE TRIGGER text_boxs_insert AFTER INSERT ON text_boxs 
BEGIN
  INSERT INTO fts(rowid, text) VALUES (new.id, new.text);
END;

CREATE TRIGGER text_boxs_delete AFTER DELETE ON text_boxs 
BEGIN
  INSERT INTO fts(fts, rowid, text) VALUES('delete', old.id, old.text);
END;
