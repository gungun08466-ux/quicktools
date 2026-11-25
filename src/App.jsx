import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Footer from './components/layout/Footer.jsx'
import Header from './components/layout/Header.jsx'
import Home from './pages/Home.jsx'
import JsonFormatter from './pages/JsonFormatter.jsx'
import AboutPage from './pages/AboutPage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import PlaceholderPage from './pages/PlaceholderPage.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'

const ImageCompressor = lazy(() => import('./pages/ImageCompressor.jsx'))
const PdfMerger = lazy(() => import('./pages/PdfMerger.jsx'))
const QrGenerator = lazy(() => import('./pages/QrGenerator.jsx'))
const PasswordGenerator = lazy(() => import('./pages/PasswordGenerator.jsx'))
const JpgToPdf = lazy(() => import('./pages/JpgToPdf.jsx'))
const PdfToJpg = lazy(() => import('./pages/PdfToJpg.jsx'))
const PdfCompressor = lazy(() => import('./pages/PdfCompressor.jsx'))
const WordCounter = lazy(() => import('./pages/WordCounter.jsx'))
const ImageResizer = lazy(() => import('./pages/ImageResizer.jsx'))
const AgeCalculator = lazy(() => import('./pages/AgeCalculator.jsx'))

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-4 py-2 text-indigo-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route
            path="/image-compressor"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Image Compressor…</p>}>
                <ImageCompressor />
              </Suspense>
            }
          />
          <Route path="/json-formatter" element={<JsonFormatter />} />
          <Route
            path="/pdf-merger"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading PDF Merger…</p>}>
                <PdfMerger />
              </Suspense>
            }
          />
          <Route
            path="/qr-generator"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading QR Code Generator…</p>}>
                <QrGenerator />
              </Suspense>
            }
          />
          <Route
            path="/password-generator"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Password Generator…</p>}>
                <PasswordGenerator />
              </Suspense>
            }
          />
          <Route
            path="/jpg-to-pdf"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading JPG to PDF Converter…</p>}>
                <JpgToPdf />
              </Suspense>
            }
          />
          <Route
            path="/pdf-to-jpg"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading PDF to JPG Converter…</p>}>
                <PdfToJpg />
              </Suspense>
            }
          />
          <Route
            path="/pdf-compressor"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading PDF Compressor…</p>}>
                <PdfCompressor />
              </Suspense>
            }
          />
          <Route
            path="/word-counter"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Word Counter…</p>}>
                <WordCounter />
              </Suspense>
            }
          />
          <Route
            path="/image-resizer"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Image Resizer…</p>}>
                <ImageResizer />
              </Suspense>
            }
          />
          <Route
            path="/age-calculator"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Age Calculator…</p>}>
                <AgeCalculator />
              </Suspense>
            }
          />
          <Route
            path="*"
            element={
              <PlaceholderPage
                title="Page not found"
                description="The page you requested could not be found."
              />
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
