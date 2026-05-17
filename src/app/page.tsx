import Link from 'next/link';
import Header from '@/components/layout/Header';
import HeroSlider from './components/HeroSlider';

export default function Home() {
  return (
    <>
      {/* ── Shared Header (auth-aware, hides admin from non-admins) ── */}
      <Header />

      {/* ── Hero Slider (Swiper initialized client-side) ── */}
      <HeroSlider />

      {/* ── Main Content ── */}
      <div className="main-content">

        {/* Choose Your Game */}
        <section className="s-lottery-online tf-spacing-1">
          <div className="tf-container">
            <div className="row">
              <div className="col-lg-12">
                <div className="heading-section mb-32">
                  <h1 className="title fw-9 fs-50">Choose Your Game</h1>
                  <p className="sub-title fw-4 fs-14">3 exciting ways to win big!</p>
                </div>

                <div className="grid-column-3 grid-wg-game">

                  {/* Lottery Card */}
                  <div className="wg-game style-1 hover-img">
                    <div className="wg-game-image image-wrap">
                      <img alt="Lottery" src="/images/item/wg-game-style-1-1.png" width={287} height={125} />
                    </div>
                    <div className="countdown-wrap style-color-1">
                      <div className="heading">
                        <h3 className="title fs-26 fw-9 mb-8">🎟️ Lottery</h3>
                        <p className="sub-title fs-12 fw-6">Smart search · Bulk buy · Alphanumeric tickets</p>
                      </div>
                      <p className="text fs-14 mb-8">Draw closes in 2 days</p>
                    </div>
                    <div className="box-winning">
                      <p className="heading fs-12 fw-6">Latest winning numbers</p>
                      <div className="winning-list">
                        {['Morning', 'Evening'].map((session) => (
                          <div key={session} className="winning-item">
                            <div className="time">
                              <p className="day fs-14 fw-6">{session}</p>
                              <p className="date fw-4">(10/05/2026)</p>
                            </div>
                            <ul className="number-list">
                              {['AH','LI','MK','98'].map((n, j) => (
                                <li key={j} className={`number-item ${j === 3 ? 'active' : ''}`}
                                  style={{ fontSize: '11px', width: '40px' }}>{n}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Link className="tf-btn btn-past" href="/games/lottery">
                      Play Lottery <i className="icon-right"></i>
                    </Link>
                  </div>

                  {/* Matka King Card */}
                  <div className="wg-game style-1 hover-img">
                    <div className="wg-game-image image-wrap">
                      <img alt="Matka King" src="/images/item/wg-game-style-1-4.png" width={353} height={131} />
                    </div>
                    <div className="countdown-wrap style-color-4">
                      <div className="heading">
                        <h3 className="title fs-26 fw-9 mb-8">🎰 Matka King</h3>
                        <p className="sub-title fs-12 fw-6">Patti · Jodi · Sangam · Single Ank</p>
                      </div>
                      <p className="text fs-14 mb-8">Results declared twice daily</p>
                    </div>
                    <div className="box-winning">
                      <p className="heading fs-12 fw-6">Today's results</p>
                      <div className="winning-list">
                        {['Milan Day', 'Kalyan'].map((market) => (
                          <div key={market} className="winning-item">
                            <div className="time">
                              <p className="day fs-14 fw-6">{market}</p>
                              <p className="date fw-4">Patti-Ank</p>
                            </div>
                            <ul className="number-list">
                              {['1','2','3','6'].map((n, j) => (
                                <li key={j} className={`number-item ${j === 3 ? 'active' : ''}`}>{n}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Link className="tf-btn btn-past" href="/games/matka">
                      Play Matka <i className="icon-right"></i>
                    </Link>
                  </div>

                  {/* Spin Wheel Card */}
                  <div className="wg-game style-1 hover-img">
                    <div className="wg-game-image image-wrap">
                      <img alt="Spin Wheel" src="/images/item/wg-game-style-1-5.png" width={329} height={131} />
                    </div>
                    <div className="countdown-wrap style-color-5">
                      <div className="heading">
                        <h3 className="title fs-26 fw-9 mb-8">🌀 Spin Wheel</h3>
                        <p className="sub-title fs-12 fw-6">Daily spins · Buy 5 get 1 free · Instant coins</p>
                      </div>
                      <p className="text fs-14 mb-8">Free spin resets daily at midnight</p>
                    </div>
                    <div className="box-winning">
                      <p className="heading fs-12 fw-6">Today's top rewards</p>
                      <div className="winning-list">
                        {['Grand Prize', 'Daily Spin'].map((tier) => (
                          <div key={tier} className="winning-item">
                            <div className="time">
                              <p className="day fs-14 fw-6">{tier}</p>
                              <p className="date fw-4">Coins</p>
                            </div>
                            <ul className="number-list">
                              {['5K','2K','1K','500'].map((n, j) => (
                                <li key={j} className={`number-item ${j === 3 ? 'active' : ''}`}
                                  style={{ fontSize: '10px', width: '38px' }}>{n}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Link className="tf-btn btn-past" href="/games/spin">
                      Spin Now <i className="icon-right"></i>
                    </Link>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Win Section */}
        <section className="s-game-play tf-spacing-1">
          <div className="tf-container">
            <div className="row">
              <div className="col-lg-12">
                <div className="heading-section mb-40">
                  <h1 className="title fw-9 fs-50 mb-8">Win up to ₹1 Crore</h1>
                  <p className="sub-title fw-4">with our 3 Instant Win Games</p>
                </div>
              </div>
              <div className="col-lg-12">
                <div className="game-play">
                  <div className="style-left">
                    <div className="slot-game game-1">
                      <div className="content">
                        <div className="image-item mb-30">
                          <img alt="" src="/images/item/game-slot-1.png" width={243} height={150} />
                        </div>
                        <h4 className="title fw-9 mb-16">🎟️ Lottery — Win up to</h4>
                        <p className="text-color-clip letter-space-0 fs-50 mb-30">
                          ₹20<span className="fs-40"> Lakh*</span>
                        </p>
                        <Link className="btn-play tf-btn h-67 fs-20" href="/games/lottery">
                          Buy Tickets <i className="icon-right"></i>
                        </Link>
                      </div>
                      <div className="image">
                        <img alt="" src="/images/item/game-slot-1-1.png" width={528} height={430} />
                      </div>
                    </div>
                  </div>
                  <div className="style-right">
                    <div className="slot-game game-2">
                      <div className="content">
                        <div className="image-item mb-16">
                          <img alt="" src="/images/item/game-slot-2.png" width={120} height={84} />
                        </div>
                        <p className="title fw-9 fs-14">🎰 Matka King — Win up to</p>
                        <p className="text-color-clip fs-30 mb-16 letter-space-0">₹1 <span className="fs-20">Crore</span></p>
                        <Link className="btn-play tf-btn h-42 fs-13" href="/games/matka">
                          Play Matka <i className="icon-right"></i>
                        </Link>
                      </div>
                      <div className="image">
                        <img alt="" src="/images/item/game-slot-2-1.png" width={300} height={180} />
                      </div>
                    </div>
                    <div className="slot-game game-3">
                      <div className="content">
                        <div className="image-item mb-16">
                          <img alt="" src="/images/item/game-slot-3.png" width={172} height={74} />
                        </div>
                        <p className="title fw-9 fs-14">🌀 Spin Wheel — Win up to</p>
                        <p className="text-color-clip fs-30 mb-16 letter-space-0">₹5 <span className="fs-20">Thousand</span></p>
                        <Link className="btn-play tf-btn h-42 fs-13" href="/games/spin">
                          Spin Now <i className="icon-right"></i>
                        </Link>
                      </div>
                      <div className="image">
                        <img alt="" src="/images/item/game-slot-3-1.png" width={219} height={181} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How to get started */}
        <section className="s-get-started tf-spacing-1">
          <div className="tf-container">
            <div className="row">
              <div className="col-lg-12">
                <div className="heading-section mb-40">
                  <h1 className="title fw-9 fs-50 mb-3">How to get started</h1>
                  <p className="sub-title fw-4 fs-14">3 simple steps to start winning!</p>
                </div>
              </div>
              {[
                { num: '01', img: '/images/section/get-started-1.png', color: 'color-4',
                  title: 'Add Coins to Wallet', desc: 'Deposit via UPI — 1 INR = 1 Coin. Secure, instant and verified.' },
                { num: '02', img: '/images/section/get-started-2.png', color: 'color-1',
                  title: 'Pick Your Game', desc: 'Choose from Lottery, Matka King, or Spin Wheel and place your bet.' },
                { num: '03', img: '/images/section/get-start-3.png', color: 'color-1',
                  title: 'Collect Your Winnings', desc: 'Coins credited instantly after result. Withdraw anytime to your bank.' },
              ].map((item) => (
                <div key={item.num} className="col-md-4">
                  <div className={`getstart-item style-2 ${item.color}`}>
                    <div className="wrapper hover-item">
                      <div className="wrap-image image-item">
                        <img alt="" src={item.img} width={150} height={150} />
                      </div>
                      <div className="content">
                        <div className="title mb-5"><a href="#">{item.title}</a></div>
                        <p>{item.desc}</p>
                      </div>
                    </div>
                    <p className="number text-color-clip style-4">{item.num}</p>
                  </div>
                </div>
              ))}
              <div className="col-lg-12">
                <div className="bot">
                  <h4 className="title-bot fw-9 mb-6">Play Responsibly, Play for Fun</h4>
                  <p className="sub type-secondary mb-20 fs-14">Set limits, take breaks, stay in control.</p>
                  <Link href="/contact" className="tf-btn">Learn more <i className="icon-right"></i></Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Play for Fun */}
        <section className="s-play-for-fun tf-spacing-2">
          <div className="tf-container">
            <div className="row">
              <div className="col-lg-12">
                <div className="play-for-fun">
                  <div className="heading-section mb-40">
                    <h1 className="title mb-3">Play Responsibly, Play for Fun</h1>
                    <p className="sub-title fs-14">Set limits, take breaks, lock games.</p>
                  </div>
                  <div className="main-section">
                    {[
                      { img: '/images/section/play-ff-1.png', title: 'Understand the rules',
                        desc: 'Know the odds for Lottery, Matka King and Spin Wheel before you play.' },
                      { img: '/images/section/play-ff-2.png', title: "Don't chase losses",
                        desc: 'Set a daily limit. If you lose, walk away — your next chance is tomorrow.' },
                      { img: '/images/section/play-ff-3.png', title: 'Real life comes first',
                        desc: 'Gaming is entertainment. Never bet more than you can afford to lose.' },
                    ].map((item, i) => (
                      <div key={i} className="content hover-item">
                        <div className="image image-item">
                          <img alt="" src={item.img} width={200} height={200} />
                        </div>
                        <div className="bot">
                          <h4 className="fw-9 mb-8">{item.title}</h4>
                          <p className="text type-secondary fs-14">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Download App */}
        <div className="tf-container">
          <div className="row">
            <div className="col-12">
              <section className="section-dowload-app">
                <div className="wrapper">
                  <div className="content">
                    <div className="title">Play Lottery, Matka & Spin<br />anywhere, anytime</div>
                    <p>All 3 games in one app. Download now and get a free spin on signup!</p>
                  </div>
                  <div className="bottom">
                    <div className="btn-dowload"><a href="#"><img alt="Android" src="/images/item/Android.jpg" width={519} height={174} /></a></div>
                    <div className="btn-dowload"><a href="#"><img alt="iOS" src="/images/item/IOS.jpg" width={519} height={174} /></a></div>
                  </div>
                  <div className="item-1"><img alt="" src="/images/item/phone.png" width={1085} height={320} /></div>
                  <div className="item coin-1"><img alt="" src="/images/item/coin-1.png" width={50} height={50} /></div>
                  <div className="item coin-2"><img alt="" src="/images/item/coin-2.png" width={55} height={54} /></div>
                </div>
              </section>
            </div>
          </div>
        </div>

      </div>{/* end .main-content */}

      {/* ── Footer ── */}
      <footer id="footer">
        <div className="footer-about">
          <div className="tf-container">
            <div className="row">
              <div className="col-12">
                <div className="footer-menu">
                  <div className="footer-logo">
                    <Link href="/"><img alt="" src="/images/logo/logo.png" width={170} height={60} /></Link>
                  </div>
                  <ul className="menu overflow-x-auto">
                    <li><Link href="/">HOME</Link></li>
                    <li><Link href="/games/lottery">LOTTERY</Link></li>
                    <li><Link href="/games/matka">MATKA KING</Link></li>
                    <li><Link href="/games/spin">SPIN WHEEL</Link></li>
                    <li><Link href="/contact">CONTACT</Link></li>
                  </ul>
                </div>
                <div className="content">
                  <p className="mb-20">
                    Supreme Gaming Engine — India's most trusted online gaming platform.
                    Play Lottery, Matka King and Spin Wheel with secure UPI payments. 1 INR = 1 Coin.
                  </p>
                  <div className="note">
                    <i className="icon-infor"></i>
                    Gambling can be harmful if not controlled. Please play responsibly.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-main">
          <div className="tf-container">
            <div className="row">
              <div className="col-lg-3 col-sm-6">
                <div className="widget-footer">
                  <div className="widget-title">Our Games</div>
                  <ul>
                    <li><Link href="/games/lottery">🎟️ Lottery</Link></li>
                    <li><Link href="/games/matka">🎰 Matka King</Link></li>
                    <li><Link href="/games/spin">🌀 Spin Wheel</Link></li>
                  </ul>
                </div>
              </div>
              <div className="col-lg-3 col-sm-6">
                <div className="widget-footer">
                  <div className="widget-title">My Account</div>
                  <ul>
                    <li><Link href="/dashboard">Dashboard</Link></li>
                    <li><Link href="/dashboard/wallet">My Wallet</Link></li>
                  </ul>
                </div>
              </div>
              <div className="col-lg-3 col-sm-6">
                <div className="widget-footer dowload-app">
                  <div className="widget-title">Download the app</div>
                  <div className="button-dowload">
                    <a className="ios" href="#"><img alt="" src="/images/item/IOS.jpg" width={519} height={174} /></a>
                    <a className="android" href="#"><img alt="" src="/images/item/Android.jpg" width={519} height={174} /></a>
                  </div>
                  <div className="bottom">
                    <div className="widget-title">Find us</div>
                    <ul className="tf-social">
                      <li><a href="#"><i className="icon-facebook"></i></a></li>
                      <li><a href="#"><i className="icon-twitter"></i></a></li>
                      <li><a href="#"><i className="icon-tiktok"></i></a></li>
                      <li><a href="#"><i className="icon-youtube"></i></a></li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="col-lg-3 col-sm-6">
                <div className="widget-footer help">
                  <div className="widget-title">How can we help?</div>
                  <Link className="tf-btn" href="/contact">
                    Contact us <i className="icon-right"></i>
                  </Link>
                  <p>Cannot find an answer? Submit a query and we will respond shortly.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="tf-container">
            <div className="row">
              <div className="col-12">
                <div className="wrapper">
                  <div className="center">
                    <ul>
                      <li><a href="#">Cookie Policy</a></li>
                      <li><a href="#">Privacy Statement</a></li>
                      <li><a href="#">Terms &amp; Conditions</a></li>
                    </ul>
                  </div>
                  <div className="right"><span>© 2025 Supreme Gaming Engine</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
