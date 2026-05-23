'use client'
import { X } from 'lucide-react'

export default function PrivacyPolicy({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="font-syne font-bold" style={{ color: '#f0eeff' }}>Kullanım Koşulları ve Gizlilik Politikası</p>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <h3 className="font-syne font-bold text-base mb-3" style={{ color: '#f0eeff' }}>1. Hizmet Şartları</h3>
          <p className="mb-4">Arke'yi kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız. Bu platform, kullanıcılar arasında iletişim sağlamak amacıyla tasarlanmıştır.</p>

          <h3 className="font-syne font-bold text-base mb-3" style={{ color: '#f0eeff' }}>2. Kabul Edilemez Kullanım</h3>
          <p className="mb-2">Aşağıdaki davranışlar kesinlikle yasaktır:</p>
          <ul className="mb-4 pl-4 flex flex-col gap-1" style={{ listStyle: 'disc' }}>
            <li>Yasadışı içerik paylaşımı</li>
            <li>Taciz, tehdit veya nefret söylemi</li>
            <li>Başkalarının hesaplarına izinsiz erişim girişimi</li>
            <li>Spam veya zararlı yazılım dağıtımı</li>
            <li>Telif hakkı ihlali</li>
          </ul>

          <h3 className="font-syne font-bold text-base mb-3" style={{ color: '#f0eeff' }}>3. Gizlilik</h3>
          <p className="mb-4">Kişisel verileriniz (kullanıcı adı, mesajlar, profil bilgileri) yalnızca hizmetin işletilmesi amacıyla kullanılır. Verileriniz üçüncü şahıslarla paylaşılmaz veya satılmaz. Supabase altyapısı üzerinde güvenli şekilde saklanır.</p>

          <h3 className="font-syne font-bold text-base mb-3" style={{ color: '#f0eeff' }}>4. İçerik Sorumluluğu</h3>
          <p className="mb-4">Paylaştığınız içeriklerden tamamen siz sorumlusunuz. Arke, kullanıcıların paylaştığı içerikleri önceden denetleme yükümlülüğü taşımaz; ancak ihlal bildirilen içerikleri kaldırma hakkını saklı tutar.</p>

          <h3 className="font-syne font-bold text-base mb-3" style={{ color: '#f0eeff' }}>5. Hesap Güvenliği</h3>
          <p className="mb-4">Hesabınızın güvenliğini sağlamak sizin sorumluluğunuzdadır. Şifrenizi kimseyle paylaşmayın. Hesabınızda yetkisiz erişim fark ederseniz derhal şifrenizi değiştirin.</p>

          <h3 className="font-syne font-bold text-base mb-3" style={{ color: '#f0eeff' }}>6. Hizmet Değişiklikleri</h3>
          <p className="mb-4">Arke, önceden bildirimde bulunmaksızın hizmeti değiştirme, duraklatma veya sonlandırma hakkını saklı tutar.</p>

          <h3 className="font-syne font-bold text-base mb-3" style={{ color: '#f0eeff' }}>7. İletişim</h3>
          <p>Sorularınız veya ihlal bildirimleri için uygulama içi destek kanalını kullanabilirsiniz.</p>
        </div>
        <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={onClose}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
            Anladım
          </button>
        </div>
      </div>
    </div>
  )
}
