'use client';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import Link from 'next/link';

const slides = [
  { style:'style-1', titleImg:'/images/page-title/home-3/page-title-item-left.png',  slideImg:'/images/page-title/home-3/slide-center.png', prize:'$2 Million*', imgW:660, imgH:372 },
  { style:'style-2', titleImg:'/images/page-title/home-3/page-title-item-right.png', slideImg:'/images/page-title/home-3/slide-right.png',  prize:'$1 Million*', imgW:712, imgH:470 },
  { style:'style-3', titleImg:'/images/page-title/home-3/page-title-item-left.png',  slideImg:'/images/page-title/home-3/slide-left.png',   prize:'$2 Million*', imgW:620, imgH:424 },
];

export default function HeroSlider() {
  return (
    <div className="page-title-home-3">
      <Swiper
        modules={[Pagination, Autoplay]}
        pagination={{ clickable: true, el: '.swiper-pagination' }}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        loop
        className="slider-home-3"
      >
        {slides.map((slide, i) => (
          <SwiperSlide key={i}>
            <div className={`slide-title-home-3 ${slide.style}`}>
              <div className="content">
                <div className="image-title">
                  <img alt="" src={slide.titleImg} width={218} height={119} />
                </div>
                <h4 className="title fw-9 mb-16">Only $25 per line <br/>4 hours to go!</h4>
                <p className="text-color-clip fs-50">{slide.prize}</p>
                <div className="bot">
                  <Link className="tf-btn btn-play" href="/games/lottery">Play from $25 </Link>
                  <p className="sub fs-14 type-secondary text-center">*Guaranteed</p>
                </div>
              </div>
              <div className="image relative">
                <img alt="" src={slide.slideImg} width={slide.imgW} height={slide.imgH} className="item-2" />
                <img alt="" src="/images/item/star-gr.png" width={2652} height={692} className="item-1 absolute" />
              </div>
            </div>
          </SwiperSlide>
        ))}
        <div className="swiper-pagination pagination-rectangle style-1"></div>
      </Swiper>
    </div>
  );
}
