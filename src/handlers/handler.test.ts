import { Handler } from "./handler"


describe('Handler', () => {
    
    const text = 'simple text 12345, 123456,\n12345678, 123-123, 1234567, sfg'
    const rgx = /\b\d{5,7}\b/g

    it('handler should returned Items array', () => {
        const h = new Handler('test', rgx)
        const items = h.process(text)
        expect(items.length).toBe(3)
        const item = items[0]
        expect(text.slice(...item.range)).toEqual('12345')
    })

    it('postFunck should called', () => {
        const mockPostFunc = jest.fn(v => v)
        const h = new Handler('test', rgx, mockPostFunc)
        h.process(text)
        expect(mockPostFunc.mock.calls).toHaveLength(3)
    })

    it('do not include item if postFunc returned null', () => {
        const h = new Handler('test', rgx, v => null)
        const items = h.process(text)
        expect(items.length).toBe(0)
    })

})