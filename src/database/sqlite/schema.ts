


// Интерфейсы для баз данных parts

export interface TextBoxDb {
    id: number,
    text: string,
    numberLine: number,
    fileId: number
}

export interface ItemDb {
    value: string,
    textBoxId: number,
    position: string
}


// Интерфейсы для базы данных master

export interface FileDb {
    fileName: string,
    mTimeMs: number,
    sizeKb: number,
    partId: number
}

export interface PartDb {
    id: number
    created: Date
}
