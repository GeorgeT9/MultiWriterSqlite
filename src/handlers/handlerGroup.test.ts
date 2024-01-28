import { HandlerGroup } from "./handlerGroup"
import { Handler } from "./handler"


describe('HandlerGroup', () => {

    const text = 'simple text 12345, 123456,\n12345678, 123-123, 1234567, sfg'
    const rgx = /\b\d{5,7}\b/g
    const h1 = new Handler('h1', rgx, (str) => str)    
    const h11 = new Handler('h1', rgx, (str) => str)    
    const h2 = new Handler('h2', rgx, () => null)    
    const hg = new HandlerGroup(h1, h2)

    it('should contain all the transmitted handlers', () => {
        expect(hg.length).toBe(2)
    })

    it('process should return Map containing not empty items', () => {
        const returnedMap = new Map()
        returnedMap.set('h1', h1.process(text))
        expect(hg.process(text)).toEqual(returnedMap)    
    })

    it('should throw error if handlers names repeated', () => {
        expect(() => new HandlerGroup(h1, h2, h11)).toThrow(Error)
    })
})