// Интерфейсы для баз данных parts

export interface FileDb {
    id: number,
    file_name: string,
    time_modified: number,
    size_kb: number,
    time_last_check: number
}

export interface TextBoxDb {
    id: number,
    text: string,
    number_block: number,
    file_id: number
}    

export interface ItemDb {
    value: string,
    text_box_id: number,
    start: number,
    end: number
}    

