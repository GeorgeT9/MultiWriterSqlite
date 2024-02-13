import { Transform, TransformCallback, TransformOptions } from "node:stream"
import { Line } from "../handlers/handlers.types"


export class LinerStream extends Transform {
    _count = 0
    _tail: string = ""

    constructor(highWaterMark: number = 10_000) {
        super({objectMode: true, highWaterMark})
    }

    _transform(chunk: string, encoding: BufferEncoding, callback: TransformCallback) {
        const data = (this._tail + chunk).split('\n')
        this._tail = data.pop() ?? ""
        for (const el of data) {
            this.push([this._count, el] satisfies Line)
            this._count += 1
        }
        callback()
    }

    _flush(callback: TransformCallback) {
        if (this._tail) {
            this.push([this._count, this._tail] satisfies Line)
        }
        callback()
    }


}
