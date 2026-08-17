import { ScreenHeader } from '@/components/screen-header'
import { requireUser } from '@/lib/dal'

export const metadata = { title: 'About · Plate' }

export default async function AboutPage() {
  await requireUser()

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ScreenHeader fallbackHref="/profile" />
      <h1 className="text-title">About</h1>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-[17px] font-semibold">Where the numbers come from</h2>
        <p className="label-muted text-[15px]">
          Packaged foods and barcodes come from <strong className="text-ink">Open Food Facts</strong>,
          a collaborative database made available under the{' '}
          <a
            className="underline"
            href="https://opendatacommons.org/licenses/odbl/1-0/"
            target="_blank"
            rel="noreferrer"
          >
            Open Database License (ODbL)
          </a>
          . Individual contents are under the DbCL, and product images are © their contributors
          under CC BY-SA.
        </p>
        <p className="label-muted text-[15px]">
          Generic whole foods come from the{' '}
          <strong className="text-ink">USDA FoodData Central</strong> SR Legacy dataset, which is in
          the public domain.
        </p>
        <a
          className="btn-secondary mt-1"
          href="https://openfoodfacts.org"
          target="_blank"
          rel="noreferrer"
        >
          Open Food Facts
        </a>
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-[17px] font-semibold">How accurate is this?</h2>
        <p className="label-muted text-[15px]">
          Photo estimates are genuinely uncertain. Independent evaluations of vision models on meal
          photographs put portion-size error around 28%, and portions are under-estimated more often
          than over-estimated — which is why every scan is broken into ingredients whose weights you
          can correct, and why totals are shown as a range.
        </p>
        <p className="label-muted text-[15px]">
          Errors largely cancel across a week, so the weekly view on Progress is far more
          trustworthy than any single meal. Your expenditure estimate is measured from what you
          actually logged against how your weight trend moved, which absorbs consistent
          under-logging on its own.
        </p>
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-[17px] font-semibold">Health score</h2>
        <p className="label-muted text-[15px]">
          Calculated with the published{' '}
          <strong className="text-ink">Nutri-Score 2023</strong> algorithm and mapped onto a 0–10
          scale. It is designed for packaged products, so treat it as a rough signal on a home-cooked
          meal rather than a verdict.
        </p>
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h2 className="text-[17px] font-semibold">This is not medical advice</h2>
        <p className="label-muted text-[15px]">
          Calorie targets here come from population-level formulas with safety floors applied. They
          are not appropriate during pregnancy, for children, or with a history of disordered
          eating. Talk to a clinician before making significant changes.
        </p>
      </section>
    </div>
  )
}
