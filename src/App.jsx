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
const PdfSplitter = lazy(() => import('./pages/PdfSplitter.jsx'))
const PdfRotator = lazy(() => import('./pages/PdfRotator.jsx'))
const QrGenerator = lazy(() => import('./pages/QrGenerator.jsx'))
const PasswordGenerator = lazy(() => import('./pages/PasswordGenerator.jsx'))
const JpgToPdf = lazy(() => import('./pages/JpgToPdf.jsx'))
const PdfToJpg = lazy(() => import('./pages/PdfToJpg.jsx'))
const PdfCompressor = lazy(() => import('./pages/PdfCompressor.jsx'))
const WordCounter = lazy(() => import('./pages/WordCounter.jsx'))
const CharacterCounter = lazy(() => import('./pages/CharacterCounter.jsx'))
const HeicToJpg = lazy(() => import('./pages/HeicToJpg.jsx'))
const PngToJpg = lazy(() => import('./pages/PngToJpg.jsx'))
const JpgToPng = lazy(() => import('./pages/JpgToPng.jsx'))
const ImageResizer = lazy(() => import('./pages/ImageResizer.jsx'))
const ImageCropper = lazy(() => import('./pages/ImageCropper.jsx'))
const AgeCalculator = lazy(() => import('./pages/AgeCalculator.jsx'))
const PercentageCalculator = lazy(() => import('./pages/PercentageCalculator.jsx'))
const UnitConverter = lazy(() => import('./pages/UnitConverter.jsx'))
const TextCaseConverter = lazy(() => import('./pages/TextCaseConverter.jsx'))
const UrlEncoderDecoder = lazy(() => import('./pages/UrlEncoderDecoder.jsx'))
const HtmlEncoderDecoder = lazy(() => import('./pages/HtmlEncoderDecoder.jsx'))
const JsonToCsv = lazy(() => import('./pages/JsonToCsv.jsx'))
const CsvToJson = lazy(() => import('./pages/CsvToJson.jsx'))
const Base64EncoderDecoder = lazy(() => import('./pages/Base64EncoderDecoder.jsx'))
const XmlFormatter = lazy(() => import('./pages/XmlFormatter.jsx'))
const MarkdownEditor = lazy(() => import('./pages/MarkdownEditor.jsx'))
const SqlFormatter = lazy(() => import('./pages/SqlFormatter.jsx'))
const RegexTester = lazy(() => import('./pages/RegexTester.jsx'))
const ColorPicker = lazy(() => import('./pages/ColorPicker.jsx'))

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
            path="/json-to-csv"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading JSON to CSV Converter…</p>}>
                <JsonToCsv />
              </Suspense>
            }
          />
          <Route
            path="/csv-to-json"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading CSV to JSON Converter…</p>}>
                <CsvToJson />
              </Suspense>
            }
          />
          <Route
            path="/base64-encoder-decoder"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Base64 Encoder &amp; Decoder…</p>}>
                <Base64EncoderDecoder />
              </Suspense>
            }
          />
          <Route
            path="/xml-formatter"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading XML Formatter &amp; Validator…</p>}>
                <XmlFormatter />
              </Suspense>
            }
          />
          <Route
            path="/markdown-editor"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Markdown Editor &amp; Preview…</p>}>
                <MarkdownEditor />
              </Suspense>
            }
          />
          <Route
            path="/sql-formatter"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading SQL Formatter…</p>}>
                <SqlFormatter />
              </Suspense>
            }
          />
          <Route
            path="/regex-tester"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Regex Tester…</p>}>
                <RegexTester />
              </Suspense>
            }
          />
          <Route
            path="/color-picker"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Color Picker &amp; Palette Generator…</p>}>
                <ColorPicker />
              </Suspense>
            }
          />
          <Route
            path="/pdf-merger"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading PDF Merger…</p>}>
                <PdfMerger />
              </Suspense>
            }
          />
          <Route
            path="/pdf-splitter"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading PDF Splitter…</p>}>
                <PdfSplitter />
              </Suspense>
            }
          />
          <Route
            path="/pdf-rotator"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading PDF Rotator…</p>}>
                <PdfRotator />
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
            path="/character-counter"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Character Counter…</p>}>
                <CharacterCounter />
              </Suspense>
            }
          />
          <Route
            path="/heic-to-jpg"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading HEIC to JPG Converter…</p>}>
                <HeicToJpg />
              </Suspense>
            }
          />
          <Route
            path="/png-to-jpg"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading PNG to JPG Converter…</p>}>
                <PngToJpg />
              </Suspense>
            }
          />
          <Route
            path="/jpg-to-png"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading JPG to PNG Converter…</p>}>
                <JpgToPng />
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
            path="/image-cropper"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Image Cropper…</p>}>
                <ImageCropper />
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
            path="/percentage-calculator"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Percentage Calculator…</p>}>
                <PercentageCalculator />
              </Suspense>
            }
          />
          <Route
            path="/unit-converter"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Unit Converter…</p>}>
                <UnitConverter />
              </Suspense>
            }
          />
          <Route
            path="/text-case-converter"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading Text Case Converter…</p>}>
                <TextCaseConverter />
              </Suspense>
            }
          />
          <Route
            path="/url-encoder-decoder"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading URL Encoder &amp; Decoder…</p>}>
                <UrlEncoderDecoder />
              </Suspense>
            }
          />
          <Route
            path="/html-encoder-decoder"
            element={
              <Suspense fallback={<p className="px-4 py-16 text-center text-slate-600">Loading HTML Encoder &amp; Decoder…</p>}>
                <HtmlEncoderDecoder />
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
