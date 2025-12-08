import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { getProductImageUrl, handleImageError } from '@/lib/utils';

const categories = [
  {
    name: 'Computers',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC0KkweQcI8HE6exDA0VO71gQckbh22wkt5sRcVHCmDEvDCZydDcpHCEFopP2F9u4fvFTDJmPq1zmPrRH-P9HhHQL63hXS578mCVeNECGKzDa-9cnX-iY_OjO8YLAXHskE16J9fvs1N4E7qRN2EGLzrkb8v4syxqWS1yCfiN2INga4YaBQEd6vr7EbuKQCnkUQTPCVul8DNUKTu7f1TytjlYxEI3BqIZlWBqHEecU7-zfruOKdyCkhKKCMUaWRmuCqvhWW-Yh5OWTg',
  },
  {
    name: 'Electronics',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBkZsUqr1W6xE18ROnV-ay1LLc2H0aBUiQL0D1TmdvWj-nfGDUUqW8dErOEnTnfQsSA2d0ZTlwXS69VSZUXNt8wCckzslFjf7ILl21c0ER2UwdVGpFxv0nHJZDXJuExhdSDTyKMarBhSjxI31bEBa8N1GGQAGrfG-XiMR6E4XPrp-a5dVU8srdDVI0BmfhVST6zsyf1OHLoLP0YEeUu8txuHlzrOecLVQB_iYhvs4w0y8OnYvljYEhG1iZyDKehNDWKbEhfeJ-8c2o',
  },
  {
    name: 'Clothing',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCGhllm4AX92wwjcmBG4KcTC9WrXGBZG6Z3hb1nbY5AWucIKsqBLJpVTCPiLuUp1vjMdG5GXDqfL8Lj3VnorgXLYTCIhnb4EEiMZKmtfozjgv6J7RpPHiK19yjRzlPdVmHnNuD_bhHVv_51Ozx6nJPOQqfd7xi9aFHc5cECNnVqjE71RNcR6vUA9NWftuQAvVkOTPRsrQAp7ZPoBoBBrEbOanNmKpnvB1Mz54k1kJde_Pr7xjJnBB1PNEOPPv55dtsfCvqBU6NsdE4',
  },
  {
    name: 'Cameras',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC063VFVXCcbBY1hfYq9ZxCpwvE5rRJkhIeNWixgjB56WHzkK2mRKsYY2EjYSm-4rUgtK3i_GCIvr4nkYauXSYDUzLqCDrC3s5xRVsubriGUPXi_M825frgtkUzi0iC-BG2eH-mrqE_OJrYKokmzsJfI-ZUcrfUMVcZ_qt2hMf7RoRYr5FLBmCgHEODyzINQ0zIssN_1A5efnB73ielpzDyyw2liiX2R0ErHVMatXoD6YDee-olKv8P-AM3tow70cbJZZQCL6ZRpBU',
  },
  {
    name: 'Indoor Living',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDVnsO1ba1DfOj1ynlbtaRZqrLNT9n1mXWIi2ITvBjHJuFk2qTPpc3RSYj7tekUA4oeL_IZl7WtfLzrOelTUOW9qi2JrcINviOi-cmP5ce6ZD6mmiOH00_akhxUDG4uXuiGzYJ9STmbkuUkXT4VtUjknEbDRHUM6eLcDNV3f8e9LskcOU_PvwrWlGqwKAp9l8hCV--TaeGd4VN8JxBHeiCet5LZMFGzjrGXSk7XGvY6rrnYDc3ssp9X0PeLxZSbvYEOYcgVIgJTkgQ',
  },
  {
    name: 'Sporting Goods',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDPFM4TWm-L4PfOSIwoAGPmRwSCOX7yjznsFaFIZ5p5Fgqbf1eGzJua-5lkBnPhWeFsseikB3kTUtv4PkJh1tzxhwqD_ASA70LgrR0y0smI9R0UTgjhh4aXHkhhbbsRSoDspyrgd89xRmfiBqycjjuDA_0FAzvB7sSo-zFuGXqHJwX3-DMxN-VxZUS7AIQYKXjQ16MdYEpoDIH9adckCvebr2yrtmkpnQiAM-PAfK7hUGZZi7DsVOhXNeEBnGKZBYAvBRWdKfh3Q3E',
  },
  {
    name: 'Furniture',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAAWmQTyE-diq4IbQUUGMT6fU0yD4nhqquW92u8TWs-pQOvO1Jc04U2kWrgUtHq-rhbRxCjPFma9qMHEFzm3Do7Dy-FX4RWj0X1C6N9UuLHPhN1G8yR1IrKwn00AaL7vgBh3LKEi-kyCMXTDkCkRXl5GVMgELb6BeyLIdGCFw9Olb_4wVUxsvkAO4Yp_EyucEWCiyEWaFc9lY3CV-5Wmnfxq0OjA0wR1nDRQ6ZnuKnredNt96LbBIsqmsIrRbakpS1HXCB9ToaeWeg',
  },
  {
    name: 'Appliances',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCpSdp5eCvuny5wJmRj-9gAjLgB01RPKoCbBqEumMSKE2faJL4IDTcEM1ud1xFojRnGCd1gMrmdhKq20_jl5Yv2z-d7zxhaWMNfk4oWWUUZJIBpFn4j9gIm6UvUyO5gQGo5BWpcX7uBF2vo-asooOnjaRTrIB_bh5dbHTtbEnOjrTlDD7OVWEEVroGQuH1wsZCuKLFqjpzrC7DpeLIcU4g_ClJ7ny82xrQVKIx6PdCMiu2tlw_mAh9sVCDN-q1RawZPm3g5PwW8n7w',
  },
  {
    name: 'Toys',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAS-1eN8TH1Zdl3IWZ3g3dTkhtk4Qv9Mxwx1Fcxpev-sQy_1ivN_WaqbMy3JQd7ugWapD7VtwOBd5e4higInkTFsrwT-sstmxTH5ruEl3i7oh7-8oVmHni_OFt_pqHkwzNRR8RpAwtXjBI2oNCpMxbTYusrM3IVF03ipFQqDGAC3Ok9vtf7rG21fTvXLFbjuG5wD92ru6t-D3jY6MYPfgIaVZTSB6lF4lwurzVp-gG0TiNvSLnCS3poZ8wips9oMsMQpcgzsiH82Ps',
  },
  {
    name: 'Health & Beauty',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBzEkYW5MRazqX1Ez91cgTt5PiJ5_NytmROIO_v9S3ppJDGsa--ojBF8ZcxG2K1p-vnBzPtRjcS3guPgmqvTMUsjQKTuewyfSeYIU_ffX29OpnHxEYjk_jm8xQq-aqeH1jrdydzQ8CBSQgzGqpE9ofZdnaXOafGyzBujRcYmWD6Ggn1PX_OShdScJWT2-BFZXI-BFfllZLLWnEV7KWKkIyaqB_yDEtaYJj3WadyoUpAbI3uVkryiR0R3nl4lMLTge2-nKD7MnKSiL4',
  },
];

export function Categories() {
  return (
    <section className="mb-12">
      <h3 className="text-muted-foreground mb-8 text-center text-3xl font-bold">
        Popular Categories
      </h3>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
        {categories.map((category, index) => (
          <div
            key={index}
            className="bg-card transform cursor-pointer rounded-2xl p-6 text-center shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <img
              src={getProductImageUrl(category.image)}
              alt={category.name}
              className="mb-4 h-32 w-full object-contain"
              onError={handleImageError}
            />
            <h4 className="text-muted-foreground font-semibold">{category.name}</h4>
          </div>
        ))}

        {/* See All Categories Button */}
        <div className="col-span-2 flex justify-center md:col-span-3 lg:col-span-6">
          <Link href="/products">
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 mt-4 rounded-full px-8 py-3 font-semibold transition duration-300">
              See All Categories
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
