
// найденное значение с его местоположением в тексте
export type Item = {
    value: string,
    range: [number, number]
}

// обработчик
export interface IHandler {
    name: string,
    process: (text: string) => Item[],
}

// отображение имени обработчика на найденные им items
export type MapItems = Map<string, Item[]>

// группа обработчиков
export interface IHandlerGroup {
    process: (text: string) => MapItems
}

// строка текста с ее порядковым номером 
export type Line = [number, string]

export type TextBox = {
    line: Line,
    items: MapItems | null
}
