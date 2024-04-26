import { Transform, TransformCallback, TransformOptions } from "node:stream"
import { Line } from "../handlers/handlers.types"



export class TextBlockStream extends Transform {
    _count = 0
    _tail: string = ""

    constructor() {
        super({objectMode: true})
    }
    
    _transform(chunk: string, encoding: BufferEncoding, callback: TransformCallback) {
        const data = (this._tail + chunk).split('\n')
        this._tail = data.pop() ?? ""
        this.push([this._count, data.join('\n')] satisfies Line)
        this._count += 1
        callback()
    }

    _flush(callback: TransformCallback) {
        if (this._tail) {
            this.push([this._count, this._tail] satisfies Line)
        }
        callback()
    }
}
