

export type Item = {
    value: string,
    range: [number, number]
}

export interface IHandler {
    name: string,
    process: (text: string) => Item[],
}

export interface IHandlerGroup {
    process: (text: string) => Map<string, Item[]>
}