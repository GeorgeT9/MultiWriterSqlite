import { Writable, Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { Line, TextBox } from "./handlers.types"
import { HandlerTransformerStream } from "./handlerTransformerStream"
import { Handler } from "./handler"
import { HandlerGroup } from "./handlerGroup"



describe('HandlerTransformerStream', () => {
    const h1 = new Handler('h1', /\b\d{5,7}\b/g, (str) => str)    
    const h2 = new Handler('h2', /\b\d{3}-\d{3}\b/g)    
    const hg = new HandlerGroup(h1, h2)
    
    const handlerTransformer = new HandlerTransformerStream(hg)
    
    async function* reader() {
        const data = [
            'simple text 12345, 123456,\n12345678, 123-123, 1234567, sfg',
            'simple text 12345, 000456,\n33345678, 123-123, 1234567, sfg',
            'simple text 12345, 222456,\n33245678, 123-123, 5554567, sfg',
        ]
        let n = 0
        while (data.length) {
            const line: Line = [n, data.pop()!]
            n += 1
            yield line
        }
    }

    let resultWriter: TextBox[] = []

    const writer = new Writable({
        write(chunk: TextBox, encoding, cb) {
            resultWriter.push(chunk)
            cb()            
        },
        objectMode: true
    })

    beforeEach(() => {
        resultWriter = []
    })

    it('should transform to TextBox', async () => {
        await pipeline(Readable.from(reader()), handlerTransformer, writer)
        expect(resultWriter.length).toBe(3)
    })
})