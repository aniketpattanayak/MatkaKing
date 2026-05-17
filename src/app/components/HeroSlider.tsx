'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function HeroSlider() {
  // Initialize Swiper after mount
  useEffect(() => {
    // Dynamically import Swiper to avoid SSR issues
    import('swiper').then(({ default: Swiper }) => {
      import('swiper/modules').then(({ Autoplay, Pagination, EffectFade }) => {
        new Swiper('.slider-home-3', {
          modules: [Autoplay, Pagination],
          loop: true,
          speed: 800,
          autoplay: { delay: 4000, disableOnInteraction: false },
          pagination: { el: '.swiper-pagination', clickable: true },
        });
      }).catch(() => {
        // Fallback: basic Swiper without modules
        try {
          new Swiper('.slider-home-3', {
            loop: true,
            speed: 800,
            autoplay: { delay: 4000 },
          });
        } catch { /* Swiper not available */ }
      });
    }).catch(() => { /* Swiper not installed */ });
  }, []);

  return (
    <div className="page-title-home-3">
      <div className="swiper swiper-container slider-home-3">
        <div className="swiper-wrapper">

          {/* Slide 1 — Lottery */}
          <div className="swiper-slide">
            <div className="slide-title-home-3 style-1">
              <div className="content">
                <div className="image-title">
                  <img alt="" src="/images/page-title/home-3/page-title-item-left.png" width={218} height={119} />
                </div>
                <h4 className="title fw-9 mb-16">🎟️ Lottery<br />Only ₹25 per ticket!</h4>
                <p className="text-color-clip fs-50">₹20 Lakh*</p>
                <div className="bot">
                  <Link className="tf-btn btn-play" href="/games/lottery">
                    Buy Tickets <i className="icon-right"></i>
                  </Link>
                  <p className="sub fs-14 type-secondary text-center">*Guaranteed Jackpot</p>
                </div>
              </div>
              <div className="image relative">
                <img alt="" src="/images/page-title/home-3/slide-center.png" width={660} height={372} className="item-2" />
                <img alt="" src="/images/item/star-gr.png" width={2652} height={692} className="item-1 absolute" />
              </div>
            </div>
          </div>

          {/* Slide 2 — Matka King */}
          <div className="swiper-slide">
            <div className="slide-title-home-3 style-2">
              <div className="content">
                <div className="image-title">
                  <img alt="" src="/images/page-title/home-3/page-title-item-right.png" width={166} height={104} />
                </div>
                <h4 className="title fw-9 mb-16">🎰 Matka King<br />Win up to 11,000x!</h4>
                <p className="text-color-clip fs-50">₹1 Crore*</p>
                <div className="bot">
                  <Link className="tf-btn btn-play" href="/games/matka">
                    Play Matka <i className="icon-right"></i>
                  </Link>
                  <p className="sub fs-14 type-secondary text-center">*Full Sangam Payout</p>
                </div>
              </div>
              <div className="image">
                <img alt="" src="/images/page-title/home-3/slide-right.png" width={712} height={470} />
              </div>
            </div>
          </div>

          {/* Slide 3 — Spin Wheel */}
          <div className="swiper-slide">
            <div className="slide-title-home-3 style-3">
              <div className="content">
                <div className="image-title">
                  <img alt="" src="/images/page-title/home-3/page-title-item-left.png" width={218} height={119} />
                </div>
                <h4 className="title fw-9 mb-16">🌀 Spin Wheel<br />Daily Free Spins!</h4>
                <p className="text-color-clip fs-50">₹5,000*</p>
                <div className="bot">
                  <Link className="tf-btn btn-play" href="/games/spin">
                    Spin Now <i className="icon-right"></i>
                  </Link>
                  <p className="sub fs-14 type-secondary text-center">*Per Spin Reward</p>
                </div>
              </div>
              <div className="image">
                <img alt="" src="/images/page-title/home-3/slide-left.png" width={620} height={424} />
              </div>
            </div>
          </div>

        </div>
        <div className="swiper-pagination pagination-rectangle style-1"></div>
      </div>
    </div>
  );
}
