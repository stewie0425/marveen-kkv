import { describe, it, expect } from 'vitest'
import { lineSet, lineRemove } from '../web/routes/secrets.js'

describe('secrets.lineSet', () => {
  it('appends to an empty body', () => {
    const out = lineSet('', 'BILLINGO_API_KEY', 'abc123')
    expect(out).toBe('BILLINGO_API_KEY=abc123\n')
  })

  it('appends to a body that already has other keys, preserving them', () => {
    const before = 'OTHER=foo\nMORE=bar\n'
    const out = lineSet(before, 'NEW', 'baz')
    expect(out).toBe('OTHER=foo\nMORE=bar\nNEW=baz\n')
  })

  it('replaces in place when the key exists', () => {
    const before = 'A=1\nB=old\nC=3\n'
    const out = lineSet(before, 'B', 'new')
    expect(out).toBe('A=1\nB=new\nC=3\n')
  })

  it('replaces only the first match if a key appears twice', () => {
    const before = 'X=one\nX=two\n'
    const out = lineSet(before, 'X', 'new')
    expect(out).toBe('X=new\nX=two\n')
  })

  it('does not collapse blank lines that already exist between keys', () => {
    const before = 'A=1\n\nB=2\n'
    const out = lineSet(before, 'B', 'updated')
    expect(out).toBe('A=1\n\nB=updated\n')
  })

  it('leaves comments alone when appending', () => {
    const before = '# header\nA=1\n'
    const out = lineSet(before, 'B', '2')
    expect(out).toBe('# header\nA=1\nB=2\n')
  })
})

describe('secrets.lineRemove', () => {
  it('returns removed=false when the key is absent', () => {
    const r = lineRemove('A=1\nB=2\n', 'C')
    expect(r.removed).toBe(false)
    expect(r.body).toBe('A=1\nB=2\n')
  })

  it('removes the matching line and reports removed=true', () => {
    const r = lineRemove('A=1\nB=2\nC=3\n', 'B')
    expect(r.removed).toBe(true)
    expect(r.body).toBe('A=1\nC=3\n')
  })

  it('removes only the first occurrence when duplicated', () => {
    const r = lineRemove('X=one\nX=two\n', 'X')
    expect(r.removed).toBe(true)
    expect(r.body).toBe('X=two\n')
  })

  it('does not match a key that is a prefix of another', () => {
    const r = lineRemove('FOO=1\nFOOBAR=2\n', 'FOO')
    expect(r.removed).toBe(true)
    // FOOBAR survives because lineRemove matches on `name + '='`.
    expect(r.body).toBe('FOOBAR=2\n')
  })
})
