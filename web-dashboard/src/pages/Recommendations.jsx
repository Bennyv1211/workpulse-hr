import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BookOpen,
  CupSoda,
  Headphones,
  Lamp,
  Laptop,
  Zap,
} from 'lucide-react'

const RECOMMENDATIONS = [
  {
    slug: 'kindle-paperwhite',
    title: 'Kindle Paperwhite',
    category: 'Books / Reading',
    Icon: BookOpen,
    url: 'https://www.amazon.com/All-new-Amazon-Kindle-Paperwhite-glare-free/dp/B0CFPJYX7P?crid=2JJARM4NXXUGU&dib=eyJ2IjoiMSJ9.19PtVsvYIrlN6GTWsPbozgkhbhvKZ0eQrU9gk-ces-dK83cgOznk2GPJu0mvY0OX-X-ihW59G-Ew-Hbk4fIeJjJQ5bqpsSLe0hAgg_TqSE9AbGY3_AMYIBvqNSUFfRuNwcpzXGjHljuIhaZAjsjhXtWVHsoPhFi500UaJFm1PEnUzx71F2nO0mtlq7C5mkMAup5uFR0TTVXN4KbhBcc46dfUi50ZKHcNKVEB-blM7xs.un09zTG7omsJABa-qIcG5XT0S-tMYf9klGAbZH1bPM4&dib_tag=se&keywords=kindle%2Bpaperwhite&qid=1780094481&sprefix=kindle%2Bpaper%2Caps%2C307&sr=8-1&th=1&linkCode=ll2&tag=1211121105-20&linkId=9f061b4d01751c46dfd1d49e1939be42&language=en_US&ref_=as_li_ss_tl',
    description:
      'An excellent everyday reading device with a lightweight design and long battery life. Great for focused reading, studying, and carrying a full library anywhere you go without any distractions.',
  },
  {
    slug: 'laptop-stand',
    title: 'Adjustable Laptop Stand',
    category: 'Workspace',
    Icon: Laptop,
    url: 'https://www.amazon.com/Amazon-Basics-Portable-Adjustable-Notebook/dp/B0BLRJ4R8F?crid=3FP4H8QYMDFYB&dib=eyJ2IjoiMSJ9.JPrReOWmFGKNe1mtn4DqQSAJGKX6Aqx_7yMIif1iZ0L7tg9o42nKSByUMzKKbTXbdie-zCkvR7VGo-LFvx9QlN0u0wVOEcjRPQAS9Vv8pes58avB96ZCETw3aJrp3O258lJN-sDb8ZGwFhbMLlWB-5fkExb0fI-IPewe2aYLmowj1yGo3wgJTk0uLmrqjhJ4Ch53cLHt4XvxKw3bT07ZT9ArRiEn94b2VKbfaVPQ1EU.iNkFwcjZycH0lYT5yi1Jz4rbWmOrz-S5-r-bjN5_8cY&dib_tag=se&keywords=adjustable%2Blaptop%2Bstand&qid=1780094516&sprefix=adjustable%2Blaptp%2Bstan%2Caps%2C413&sr=8-1-spons&sp_csd=d2lkZ2V0TmFtZT1zcF9hdGY&th=1&linkCode=ll2&tag=1211121105-20&linkId=bde08e497b8be096f2e1cc0ddcc1d551&language=en_US&ref_=as_li_ss_tl',
    description:
      'A simple change that quietly fixes your posture. Raises your screen to eye level, keeps your laptop cooler during long sessions, and folds flat so it travels well between desks.',
  },
  {
    slug: 'celsius-energy-drink',
    title: 'CELSIUS Sparkling Green Apple Cherry, Sugar Free Energy Drink',
    category: 'Wellness / Energy',
    Icon: Zap,
    url: 'https://www.amazon.com/CELSIUS-Sparkling-Cherry-Functional-Essential/dp/B0BNW78Y32?crid=2D99MGXBEX0RX&dib=eyJ2IjoiMSJ9.W4jt0qJ38LhHauzQr-4U1DD_W3JXTEGLZSanxbb9ma-rEHTbCwIAIdTEhxAngxqbBK-IWj1AzbVEydMaGsiqLgduEmEagf2zukcNF1TWRc6xqS8tbZ9BDYkhbgY1n-zbvs1xtsTIcI_1pvUlZPWIX9SI73T6BhuKYdAIHReT9cxfqWDa_35MfXgY-_w18_kfsWaBXBJzYGy4gZPvlIpqf7_KVF-WvbI-6bICrbbRmLE8XfKC7fjmPI_-tQAqDJBwYGiBKPGEhovC1Pes6OK-KI8MU-JAW1spX9ClIi1fzis.HtJz_61j6dBiRJyJzPAxH7P8-hGxoos7WNAzyIY5Kcs&dib_tag=se&keywords=cherry%2Bcelsius&qid=1780094249&rdc=1&sprefix=cherry%2Bcelcius%2Caps%2C227&sr=8-1&th=1&linkCode=ll2&tag=1211121105-20&linkId=889cb89ee2136e0408a6464086f5d720&language=en_US&ref_=as_li_ss_tl',
    description:
      'A sugar-free energy drink we keep stocked for long afternoons and pre-workout focus. The green apple cherry flavor is crisp without being syrupy, and the 12-pack means you actually have one when you need it. Comes as 12 fl oz cans, sugar free.',
  },
  {
    slug: 'desk-lamp',
    title: 'Warm LED Desk Lamp',
    category: 'Workspace',
    Icon: Lamp,
    url: 'https://www.amazon.com/Airlonv-Eye-Caring-Adjustable-Gooseneck-Workbench/dp/B0C4JTPPYY?crid=22ROMI8PEXZ1Q&dib=eyJ2IjoiMSJ9.nVVY-H1N_CX-u-OkLHUeFUWTbd0PnRTFLBWAsNTpqF6WqtdhHCeWnHb1d2rFq9rNoAxHN04UaYxWyc5rc0C5LfLPdP_pocne1UNrYEDAvgutY860rdz6AssQpCEUQuXCtdC6v_fb5Ia0X3wTE1HECvUQJPINjc3ZMTypWwv2IYNhRb9zAcZEGAUeI5ftaw1ZG-45Lx_mKUuC-7K2bUoHk55qjurJDO_nJRxd2CiypMGzTZ2YU1vWjABGgZWs3lfQC-NTq65hCcT7PvaYVYi2d0orjd3wytPiguU42TcXhHQ.BVxA0Ze4ofHmqpzfb7F4saG3bo5krofVsH_Aab_W5dU&dib_tag=se&keywords=warm%2Bled%2Bdesk%2Blamp&qid=1780094431&sprefix=warm%2Bled%2Bdesk%2Blamp%2Caps%2C320&sr=8-4-spons&sp_csd=d2lkZ2V0TmFtZT1zcF9hdGY&th=1&linkCode=ll2&tag=1211121105-20&linkId=5a47b881e80080293538e96abb87e73f&language=en_US&ref_=as_li_ss_tl',
    description:
      "Soft, adjustable lighting that's easy on the eyes during late work or early mornings. A quiet upgrade that makes your desk feel calmer and helps you focus without the harsh overhead glare.",
  },
  {
    slug: 'noise-cancelling-headphones',
    title: 'Noise-Cancelling Headphones',
    category: 'Focus',
    Icon: Headphones,
    url: 'https://www.amazon.com/MMWOWARTS-Bluetooth-Headphones-Cancelling-Wireless/dp/B0GLNPYVM6?crid=1WG7VW0OX7M5V&dib=eyJ2IjoiMSJ9.60Tz-PJv0qgMjfpAIxHU9wkTWZ9p60FMONcwa6q9yS5Mep1Y3br5OawpElw68VeiYK1-kYvtc0ARTtoIm_g1AyLpMHyD27d5Kjb_R0XTHBvICUTodt1BzmQieZdgyIeFoAcpuXKwlB_00_Uo1BMAZr2js9ulqwNy07rVrLlVLpHJOMMTi7jHktDGcKMe_En8vJDg9c9O7BqHMUFciuUjn10YorLZZ2O23tJCADoAP6s.TF4AqOc0JYh6dZzZbSy76SEVW9PYwBRxIoVdELQMy2I&dib_tag=se&keywords=noise%2Bcanceling%2Bheadphones&qid=1780094384&sprefix=nois%2Bcanceling%2Bheadphone%2Caps%2C545&sr=8-1&th=1&linkCode=ll2&tag=1211121105-20&linkId=a9cccd8c13f5deb7e959e52e69fbcc3b&language=en_US&ref_=as_li_ss_tl',
    description:
      'Worth every bit of the price if deep work is part of your day. They mute the office, the cafe, the airport, and leave you with the quiet you need to actually think for an hour at a time.',
  },
  {
    slug: 'celsius-blue-razz-lemonade',
    title: 'CELSIUS Fizz Free Blue Razz Lemonade, Sugar Free Energy Drink',
    category: 'Wellness / Energy',
    Icon: CupSoda,
    url: 'https://www.amazon.com/CELSIUS-Sparkling-Cherry-Functional-Essential/dp/B0CRJ2HLMQ?crid=2D99MGXBEX0RX&dib=eyJ2IjoiMSJ9.W4jt0qJ38LhHauzQr-4U1DD_W3JXTEGLZSanxbb9ma-rEHTbCwIAIdTEhxAngxqbBK-IWj1AzbVEydMaGsiqLgduEmEagf2zukcNF1TWRc6xqS8tbZ9BDYkhbgY1n-zbvs1xtsTIcI_1pvUlZPWIX9SI73T6BhuKYdAIHReT9cxfqWDa_35MfXgY-_w18_kfsWaBXBJzYGy4gZPvlIpqf7_KVF-WvbI-6bICrbbRmLE8XfKC7fjmPI_-tQAqDJBwYGiBKPGEhovC1Pes6OK-KI8MU-JAW1spX9ClIi1fzis.HtJz_61j6dBiRJyJzPAxH7P8-hGxoos7WNAzyIY5Kcs&dib_tag=se&keywords=cherry%2Bcelsius&qid=1780094249&rdc=1&sprefix=cherry%2Bcelcius%2Caps%2C227&sr=8-1&th=1&linkCode=ll2&tag=1211121105-20&linkId=30320e8c7d456a02d7293e0026c0b73a&language=en_US&ref_=as_li_ss_tl',
    description:
      'The non-carbonated option from Celsius, same clean energy without the fizz, which makes it easier to sip through a long work session or a workout. Blue razz lemonade is tart, refreshing, and not overly sweet. Comes as a 12-pack of 12 fl oz cans, sugar free.',
  },
]

function RecommendationCard({ item }) {
  const { title, category, description, Icon, url } = item

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.18)]">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(37,99,235,0.06), transparent 40%), radial-gradient(circle at 80% 70%, rgba(251,146,60,0.05), transparent 40%)',
          }}
        />
        <Icon
          className="relative h-16 w-16 text-slate-400 transition-transform duration-300 group-hover:scale-105"
          strokeWidth={1.25}
          aria-hidden="true"
        />
      </div>

      <div className="flex flex-1 flex-col px-6 py-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">
          {category}
        </span>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{title}</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{description}</p>

        <div className="mt-6 pt-1">
          <a
            href={url}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            View on Amazon
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
          </a>
        </div>
      </div>
    </article>
  )
}

export default function Recommendations() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/emplora-wordmark.svg" alt="Emplora" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
            >
              Create HR Account
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 px-6 py-12 shadow-sm sm:px-8 lg:px-10 lg:py-16">
          <div className="max-w-4xl">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
              Editorial picks
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
              What We Recommend
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              Here are a few products, tools, and resources we genuinely recommend.
              We&apos;ve curated this collection based on usefulness, quality, and
              everyday value.
            </p>
          </div>
        </section>

        <section className="py-10 sm:py-12 lg:py-14">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                The Collection
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Six things worth your attention
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 xl:grid-cols-3">
            {RECOMMENDATIONS.map((item) => (
              <RecommendationCard key={item.slug} item={item} />
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white">
          <div className="max-w-3xl px-6 py-10 sm:px-8 sm:py-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Disclosure
            </h2>
            <p className="mt-5 text-lg font-semibold leading-relaxed text-slate-900">
              As an Amazon Associate I earn from qualifying purchases.
            </p>
            <p className="mt-4 text-[16px] leading-relaxed text-slate-600">
              This helps support Emplora at no additional cost to you. We only
              recommend products we genuinely believe are useful and worth sharing.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-center sm:px-6 md:flex-row md:text-left lg:px-8">
          <p className="text-sm text-slate-500">© 2026 Emplora. All rights reserved.</p>
          <div className="flex items-center gap-5 text-sm">
            <Link to="/" className="text-slate-600 transition-colors hover:text-slate-900">
              Home
            </Link>
            <Link to="/login" className="text-slate-600 transition-colors hover:text-slate-900">
              Sign In
            </Link>
            <Link to="/signup" className="text-slate-600 transition-colors hover:text-slate-900">
              Create HR Account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
