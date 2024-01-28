

export type Item = {
    value: string,
    range: [number, number]
}


export interface IHandler {
    name: string,
    process: (text: string) => Item[],
}