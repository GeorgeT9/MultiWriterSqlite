import { IHandlerGroup, Line, TextBox } from "./handlers.types"
import { Transform, TransformCallback, TransformOptions } from "node:stream"


/**
 * Обрабатывает поступающие Lines, выполняет извлечение из текста 
 * Item и формирует TextBox  
 */
export class HandlerTransformerStream extends Transform{
    private readonly _handlerGroup: IHandlerGroup 

    constructor(handlerGroup: IHandlerGroup, highWaterMark: number = 10000) {
        super({objectMode: true, highWaterMark})
        this._handlerGroup = handlerGroup
    }   

    _transform(chunk: Line, encoding: BufferEncoding, callback: TransformCallback) {
        try {
            const itemsMap = this._handlerGroup.process(chunk[1])
            const textBox: TextBox = {
                line: chunk,
                items: itemsMap.size ? itemsMap : null
            } 
            this.push(textBox)
            callback(null)
        } catch (error) {
            callback(new Error(`ошибка при обработке строки ${chunk[0]}: ${(error as Error).message}`, {
                cause: error
            }))
        }
    }
}