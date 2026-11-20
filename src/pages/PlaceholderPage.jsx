import PageMetadata from '../components/seo/PageMetadata.jsx'

export default function PlaceholderPage({ title, description }) {
  return (
    <>
      <PageMetadata title={title} description={description} />
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-3 text-slate-600">This page is planned for a future phase.</p>
      </section>
    </>
  )
}
