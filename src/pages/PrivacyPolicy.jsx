import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageMetadata from '../components/seo/PageMetadata.jsx'

export default function PrivacyPolicy() {
  return (
    <>
      <PageMetadata
        title="Privacy Policy"
        description="Learn what QuickTools processes in your browser, what information its website code does not collect, and how to use the tools privately."
      />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
            <ShieldCheck aria-hidden="true" size={16} />
            Privacy by design
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-slate-500">Last updated: November 21, 2026</p>
        </header>

        <div className="mt-7 space-y-7 text-base leading-7 text-slate-700">
          <section aria-labelledby="local-processing">
            <h2 id="local-processing" className="text-xl font-semibold text-slate-950">
              Files and content are processed in your browser
            </h2>
            <p className="mt-2">
              The Image Compressor, Image Resizer, PDF Merger, PDF Compressor,
              and JPG/PDF converters process selected files on your device. The JSON
              Formatter, Word Counter, and QR Code Generator process the text
              you enter in your browser, and passwords are generated locally. The QuickTools
              application does not send this content to an application backend
              or file-processing service. Generated results are made available
              in your browser for download, and generated passwords are not stored.
            </p>
          </section>

          <section aria-labelledby="collection">
            <h2 id="collection" className="text-xl font-semibold text-slate-950">
              Information collected by QuickTools
            </h2>
            <p className="mt-2">
              The application does not include accounts, analytics, advertising,
              tracking cookies, or a database, and it does not currently use
              localStorage or sessionStorage. It does not intentionally collect
              or store the text or files you use in a tool. Browser-managed
              downloads and clipboard actions are separate from application
              storage; your browser may retain downloads according to your
              settings, and copying writes the selected content to your
              clipboard when supported and permitted.
            </p>
          </section>

          <section aria-labelledby="hosting">
            <h2 id="hosting" className="text-xl font-semibold text-slate-950">
              Website hosting and your browser
            </h2>
            <p className="mt-2">
              QuickTools is hosted by Vercel. As part of hosting, delivering,
              securing, and operating the website, Vercel may process technical
              and connection information. This hosting-related processing is
              separate from the local processing performed by the tools. For
              details, see{' '}
              <a
                className="font-medium text-indigo-700 underline"
                href="https://vercel.com/legal/privacy-notice"
                target="_blank"
                rel="noreferrer"
              >
                Vercel’s Privacy Notice
              </a>.
            </p>
          </section>

          <section aria-labelledby="clipboard">
            <h2 id="clipboard" className="text-xl font-semibold text-slate-950">
              Clipboard access
            </h2>
            <p className="mt-2">
              When you choose a copy action, the JSON Formatter writes the editor
              text or the QR Code Generator writes its generated image to your
              browser clipboard, if supported and permitted by your browser.
              QuickTools does not read clipboard contents.
            </p>
          </section>

          <section aria-labelledby="changes">
            <h2 id="changes" className="text-xl font-semibold text-slate-950">
              Policy updates
            </h2>
            <p className="mt-2">
              This policy may be updated if the site or its data practices change.
              The date above will be revised when changes are made.
            </p>
          </section>

          <section aria-labelledby="contact">
            <h2 id="contact" className="text-xl font-semibold text-slate-950">
              Contact
            </h2>
            <p className="mt-2">
              For privacy questions or general support, please visit the{' '}
              <Link className="font-medium text-indigo-700 underline" to="/contact">
                Contact page
              </Link>.
            </p>
          </section>

          <aside className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            <p className="flex items-start gap-2">
              <LockKeyhole aria-hidden="true" size={17} className="mt-1 shrink-0" />
              <span>
                Keep in mind that using a browser-based tool does not make the
                device itself private; anyone with access to your device or
                clipboard may be able to access content you use or copy.
              </span>
            </p>
          </aside>
        </div>
      </article>
    </>
  )
}
