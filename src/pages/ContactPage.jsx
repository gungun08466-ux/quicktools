import { Mail } from 'lucide-react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

export default function ContactPage() {
  return (
    <>
      <PageMetadata
        title="Contact"
        description="Contact QuickTools. A public support email has not yet been configured."
      />
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
          <Mail aria-hidden="true" size={16} />
          Contact
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Contact QuickTools
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          A public support email or contact form has not been configured yet.
          Before launch, the site owner should add a monitored contact method here
          so users can ask questions or report issues.
        </p>
      </section>
    </>
  )
}
