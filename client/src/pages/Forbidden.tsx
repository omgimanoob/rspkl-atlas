export function Forbidden() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md space-y-4 border rounded p-6 text-center">
        <div className="text-3xl">🚫</div>
        <h1 className="text-xl font-semibold">Forbidden</h1>
        <p className="text-sm text-gray-600">You do not have permission to access this page.</p>
        <a href="/" className="inline-block px-4 py-2 rounded border text-sm">Go home</a>
      </div>
    </div>
  )
}

