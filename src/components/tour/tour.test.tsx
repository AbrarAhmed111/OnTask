import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TourHighlight } from '@/components/tour/TourHighlight'
import { TourPopover } from '@/components/tour/TourPopover'
import type { PopoverPosition } from '@/lib/tour/geometry'

const noop = () => {}

const below: PopoverPosition = {
  placement: 'bottom',
  top: 214,
  left: 30,
  arrow: { side: 'top', offset: 170 },
}

const renderPopover = (
  props: Partial<Parameters<typeof TourPopover>[0]> = {},
) =>
  renderToStaticMarkup(
    <TourPopover
      title="Goals"
      description="Goals represent the bigger outcomes you're working toward."
      stepNumber={2}
      stepCount={5}
      visible
      position={below}
      onNext={noop}
      onBack={noop}
      onSkip={noop}
      {...props}
    />,
  )

describe('TourPopover', () => {
  it('says where the user is and what this step is', () => {
    const html = renderPopover()
    expect(html).toContain('Step 2 of 5')
    expect(html).toContain('>Goals<')
    expect(html).toContain('bigger outcomes')
  })

  it('offers Back, Next and Skip in the middle of a tour', () => {
    const html = renderPopover()
    expect(html).toContain('>Back<')
    expect(html).toContain('>Next<')
    expect(html).toContain('>Skip tour<')
  })

  it('has no Back on the first step', () => {
    expect(renderPopover({ stepNumber: 1 })).not.toContain('>Back<')
  })

  it('finishes with Done on the last step', () => {
    const html = renderPopover({ stepNumber: 5 })
    expect(html).toContain('>Done<')
    expect(html).not.toContain('>Next<')
    // Done is the way out; a second "Skip tour" beside it would be noise.
    expect(html).not.toContain('>Skip tour<')
  })

  it('can always be closed, even on the last step', () => {
    for (const stepNumber of [1, 3, 5]) {
      expect(renderPopover({ stepNumber })).toContain('aria-label="Close tour"')
    }
  })

  it('is a labelled, non-modal dialog, so the app behind stays reachable', () => {
    const html = renderPopover()
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-labelledby=')
    expect(html).toContain('aria-describedby=')
    expect(html).not.toContain('aria-modal')
  })

  it('marks the button the keyboard should land on', () => {
    expect(renderPopover()).toContain('data-tour-primary')
  })

  it('shows the hint only when the step has one', () => {
    expect(renderPopover({ hint: 'Everyone in the workspace.' })).toContain(
      'Everyone in the workspace.',
    )
    expect(renderPopover()).not.toContain('Everyone in the workspace.')
  })

  it('is placed where the layout put it, with an arrow towards the target', () => {
    const html = renderPopover()
    expect(html).toContain('top:214px')
    expect(html).toContain('left:30px')
    expect(html).toContain('width:340px')
    expect(html).toContain('rotate-45')
  })

  it('stays out of sight and out of the way until the step has arrived', () => {
    expect(renderPopover({ visible: true })).not.toContain('invisible')
    const hidden = renderPopover({ visible: false })
    expect(hidden).toContain('invisible')
    expect(hidden).toContain('pointer-events-none')
  })

  it('becomes a bottom card on a phone, above the home indicator, no arrow', () => {
    const html = renderPopover({
      position: { placement: 'sheet', top: 500, left: 12 },
    })
    expect(html).toContain('safe-area-inset-bottom')
    expect(html).not.toContain('width:340px')
    expect(html).not.toContain('rotate-45')
  })
})

describe('TourHighlight', () => {
  const render = (props: Parameters<typeof TourHighlight>[0]) =>
    renderToStaticMarkup(<TourHighlight {...props} />)

  it('cuts a hole around the target in a dark backdrop', () => {
    const html = render({
      rect: { top: 100, left: 40, width: 300, height: 120 },
      radius: 18,
      glide: true,
    })
    expect(html).toContain('top:100px')
    expect(html).toContain('left:40px')
    expect(html).toContain('width:300px')
    expect(html).toContain('height:120px')
    expect(html).toContain('border-radius:18px')
    expect(html).toContain('0 0 0 9999px rgba(0, 0, 0, 0.6)')
  })

  it('never intercepts the pointer and is hidden from assistive tech', () => {
    const html = render({ rect: null, radius: 0, glide: false })
    expect(html).toContain('pointer-events-none')
    expect(html).toContain('aria-hidden="true"')
  })

  it('dims the whole viewport before there is a target to frame', () => {
    const html = render({ rect: null, radius: 0, glide: false })
    expect(html).toContain('0 0 0 9999px rgba(0, 0, 0, 0.6)')
    expect(html).not.toContain('255, 255, 255')
  })

  it('sits above the app but below the popover', () => {
    expect(render({ rect: null, radius: 0, glide: false })).toContain('z-[61]')
    expect(renderPopover()).toContain('z-[62]')
  })

  it('glides between steps that need no scrolling, but follows a scroll instantly', () => {
    const rect = { top: 0, left: 0, width: 10, height: 10 }
    expect(render({ rect, radius: 0, glide: true })).toContain('transition-[')
    expect(render({ rect, radius: 0, glide: false })).not.toContain(
      'transition-[',
    )
  })
})
