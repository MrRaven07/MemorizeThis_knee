import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRng } from '@/core/random/rng'
import FaceView from './FaceView.vue'
import { generateFaces } from './faces'

describe('FaceView', () => {
  it('draws a decorative SVG face; distinct faces render differently', () => {
    const faces = generateFaces(createRng(9), 6)
    const html = faces.map((face) => mount(FaceView, { props: { face } }).find('svg').html())
    expect(new Set(html).size).toBe(6)
    const w = mount(FaceView, { props: { face: faces[0]! } })
    expect(w.find('svg').attributes('aria-hidden')).toBe('true')
  })

  it('shows glasses, beard and earrings when the face has them', () => {
    const [base] = generateFaces(createRng(1), 1)
    const face = {
      ...base!,
      presentation: 'm' as const,
      glasses: true,
      facialHair: 1,
      earrings: true,
    }
    const w = mount(FaceView, { props: { face } })
    expect(w.find('.glasses').exists()).toBe(true)
    expect(w.find('.beard').exists()).toBe(true)
    expect(w.findAll('.earring')).toHaveLength(2)
    const plain = mount(FaceView, {
      props: { face: { ...face, glasses: false, facialHair: 0, earrings: false } },
    })
    expect(plain.find('.glasses').exists()).toBe(false)
    expect(plain.find('.beard').exists()).toBe(false)
  })
})
