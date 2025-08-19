import { headers } from 'next/headers'
import AuthLoginForm from './auth-login-form'

export default function AuthLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-4">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Accès restreint
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Site privé - Authentification requise
          </p>
        </div>
        <AuthLoginForm />
      </div>
    </div>
  )
}