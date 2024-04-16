// Интерфейсы для баз данных parts

export interface FileDb {
    id: number,
    fileName: string,
    mTimeMs: number,
    sizeKb: number,
    partId: number,
    checkTimeMs: number
}

export interface TextBoxDb {
    id: number,
    text: string,
    numberLine: number,
    fileId: number
}    

export interface ItemDb {
    value: string,
    textBoxId: number,
    position: [number, number]
}    

