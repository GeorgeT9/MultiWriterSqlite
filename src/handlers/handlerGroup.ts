import { IHandlerGroup, Item, IHandler } from "./handlers.types"


export class HandlerGroup implements IHandlerGroup {
    private readonly _handlers: IHandler[]

    constructor(...handlers: IHandler[] ) {
        // проверка на повторяющиеся имена 
        const handlersNames = handlers.map(h => h.name)
        if (handlersNames.length !== [...new Set(handlersNames)].length) {
            throw new Error('HandlerGroup содержит повторяющиеся имена hanlers')
        }
        this._handlers = handlers
    }

    process(text: string): Map<string, Item[]> {
        const out = new Map()
        for (const h of this._handlers) {
            const items = h.process(text)
            if (items.length) {
                out.set(h.name, items)
            }
        }
        return out
    }

    get length() {
        return this._handlers.length
    }

}