export interface RingOption {
  id: number;
  brand: string;
  name: string;
  material: string;
  priceSet: string;
  link?: string;
  note?: string;
  images?: string[];
  /** 'contain' = clean product image, 'product' = crop screenshot text and center the ring */
  imgFit?:
    | 'contain'
    | 'top'
    | 'center'
    | 'product'
    | 'centerProduct'
    | 'flatProduct'
    | 'smallProduct'
    | 'cleanProduct'
    | 'slightLeftProduct'
    | 'slightLeftCenterProduct';
}

export const ringUsers = [
  { id: 'yaechan', name: 'Yaechan', emoji: '🤵' },
  { id: 'sulki', name: 'Sulki', emoji: '👰' },
  { id: 'hyanggi', name: 'Hyanggi', emoji: '👩' },
] as const;

export type RingUserId = (typeof ringUsers)[number]['id'];

export const tiffanyQuote = {
  basic: {
    bride3mm: 2440000,
    groom4mm: 3400000,
    setTotal: 5840000,
  },
  diamond: {
    bride3mm: 2740000,
    groom4mm: 3990000,
    setTotal: 6730000,
  },
  brideOnlyDiamond: 6140000,
};

export const ringBudget = {
  min: 7000000,
  max: 0,
  brideWidth: '3mm',
  brideSize: '4.5호',
  groomWidth: '4mm',
  groomSize: '9.5호',
  material: 'PT950',
  style: '밀그레인 / 클래식 플랫밴드',
};

export const ringOptions: RingOption[] = [
  // Tiffany & Co. — 이미지: 반지 상단, 텍스트 하단 → top crop
  { id: 1, brand: 'Tiffany & Co.', name: '클래식 밀그레인 밴드', material: 'PT950', priceSet: '~₩400만', link: 'https://www.tiffany.kr/engagement/wedding-band-sets/', images: ['티파니 클래식 밀그레인.png'], imgFit: 'product' },
  { id: 2, brand: 'Tiffany & Co.', name: '티파니 포에버 밴드 (2mm DI)', material: 'PT950', priceSet: '₩274만', link: 'https://www.tiffany.kr/designers-collections/tiffany-forever/', note: '다이아 세팅, 2mm', images: ['티파니 포에버_2mm_di.png'], imgFit: 'centerProduct' },
  { id: 3, brand: 'Tiffany & Co.', name: '투게더 밀그레인 밴드 (기본)', material: 'PT950', priceSet: '₩244~340만', link: 'https://www.tiffany.kr/designers-collections/tiffany-together/', note: '판교점 견적 완료 · 3mm ₩244만 / 4mm ₩340만', images: ['티파니 투게더_3mm.png', '티파니 투게더_4mm.png'], imgFit: 'flatProduct' },
  { id: 52, brand: 'Tiffany & Co.', name: '투게더 밀그레인 밴드 (DI)', material: 'PT950', priceSet: '₩274~399만', link: 'https://www.tiffany.kr/designers-collections/tiffany-together/', note: '판교점 견적 완료 · 3mm DI ₩274만 / 4mm DI ₩399만', images: ['티파니 투게더_3mm_DI.png', '티파니 투게더_4mm_DI.png'], imgFit: 'flatProduct' },
  { id: 4, brand: 'Tiffany & Co.', name: '티파니 T 트루 내로우 밴드', material: '18K WG', priceSet: '₩381만', link: 'https://www.tiffany.kr/engagement/womens-wedding-bands/', note: 'T 모티프, 모던', images: ['티파니 T.png'], imgFit: 'flatProduct' },
  { id: 5, brand: 'Tiffany & Co.', name: '찰스 티파니 세팅 밴드', material: 'PT950', priceSet: '~₩530만', link: 'https://www.tiffany.kr/engagement/mens-wedding-bands/', note: '새틴 마감, 프리미엄' },
  { id: 49, brand: 'Tiffany & Co.', name: '티파니 트루 밴드 (DI)', material: 'PT950', priceSet: '₩292만', link: 'https://www.tiffany.kr/engagement/shop/womens-wedding-bands/', note: '기하학 컷, 다이아', images: ['티파니 트루.png'], imgFit: 'product' },
  { id: 50, brand: 'Tiffany & Co.', name: '메트로 풀 이터니티 링 (DI)', material: 'PT950', priceSet: '₩473만', link: 'https://www.tiffany.kr/engagement/shop/womens-wedding-bands/', note: '풀 이터니티 다이아 세팅', images: ['티파니 메트로.png'], imgFit: 'flatProduct' },
  { id: 51, brand: 'Tiffany & Co.', name: '엘사 퍼레티 웨딩밴드 (DI)', material: 'PT950', priceSet: '₩371만', link: 'https://www.tiffany.kr/engagement/shop/womens-wedding-bands/', note: '유기적 커브, 7P 다이아', images: ['티파니 엘사 퍼레티.png'], imgFit: 'product' },

  // Cartier — 이미지: 반지 상단~중앙, 텍스트 하단
  { id: 6, brand: 'Cartier', name: 'LOVE 웨딩 밴드 (스몰)', material: '18K WG', priceSet: '₩234만', link: 'https://www.cartier.com/ko-kr/%EC%A3%BC%EC%96%BC%EB%A6%AC/%EC%9B%A8%EB%94%A9-%EB%B0%B4%EB%93%9C/', note: '아이코닉 스크류 모티브', images: ['까르띠에 Love_화이트골드.png'], imgFit: 'product' },
  { id: 7, brand: 'Cartier', name: '1895 웨딩 밴드 (2.6mm DI)', material: 'PT950', priceSet: '₩249~299만', link: 'https://www.cartier.com/ko-kr/%EC%A3%BC%EC%96%BC%EB%A6%AC/%EC%9B%A8%EB%94%A9-%EB%B0%B4%EB%93%9C/', note: '다이아 1개 ₩249만 / 3개 ₩299만', images: ['까르띠에 1895_2.6mm_di_2.png', '까르띠에 1895_2.6mm_di.png'], imgFit: 'centerProduct' },
  { id: 8, brand: 'Cartier', name: 'C 드 까르띠에 웨딩 밴드 (3mm DI)', material: '18K PG', priceSet: '₩265만', link: 'https://www.cartier.com/ko-kr/%EC%A3%BC%EC%96%BC%EB%A6%AC/%EC%9B%A8%EB%94%A9-%EB%B0%B4%EB%93%9C/', note: '핑크골드, 다이아, 로고 각인', images: ['까르띠에 C 드 까르띠에_3mm_di.png', '까르띠에 C 드 까르띠에_3mm_di_2.png'], imgFit: 'product' },
  { id: 9, brand: 'Cartier', name: '까르띠에 다무르 웨딩 밴드 (3.5mm)', material: 'PT950', priceSet: '₩331만', link: 'https://www.cartier.com/ko-kr/%EC%A3%BC%EC%96%BC%EB%A6%AC/%EC%9B%A8%EB%94%A9-%EB%B0%B4%EB%93%9C/', note: '볼륨감 있는 곡선형', images: ['까르띠에 다무르_3.5mm.png'], imgFit: 'product' },
  { id: 10, brand: 'Cartier', name: '트리니티 웨딩 밴드', material: '18K 삼색', priceSet: '~₩450만', link: 'https://www.cartier.com/ko-kr/%EC%A3%BC%EC%96%BC%EB%A6%AC/%EC%9B%A8%EB%94%A9-%EB%B0%B4%EB%93%9C/', note: '삼색골드, 유니크' },
  { id: 11, brand: 'Cartier', name: '발레린 웨딩 밴드 (1P 다이아)', material: 'PT950', priceSet: '~₩380만', link: 'https://www.cartier.com/ko-kr/%EC%A3%BC%EC%96%BC%EB%A6%AC/%EC%9B%A8%EB%94%A9-%EB%B0%B4%EB%93%9C/', note: '여성용 다이아 포인트' },

  // Chaumet
  { id: 12, brand: 'Chaumet', name: '레 제떼르넬 드 쇼메 (2.5mm)', material: 'PT950', priceSet: '~₩420만', link: 'https://www.chaumet.com/kr_kr/bridal/women-wedding-bands', note: '심플 + 다이아 하프서클' },
  { id: 13, brand: 'Chaumet', name: '토르사드 드 쇼메', material: 'PT950', priceSet: '~₩470만', link: 'https://www.chaumet.com/kr_kr/bridal/women-wedding-bands', note: '꼬임 디자인, 우아함' },
  { id: 14, brand: 'Chaumet', name: '조세핀 아무르 아그레뜨 밴드', material: 'PT950', priceSet: '~₩450만', link: 'https://www.chaumet.com/kr_kr/bridal/women-wedding-bands', note: '티아라 모티프, 여성적' },
  { id: 15, brand: 'Chaumet', name: '트리옹프 드 쇼메', material: 'PT950/PG', priceSet: '~₩480만', link: 'https://www.chaumet.com/kr_kr/bridal/men-wedding-bands', note: '월계관 모티프' },
  { id: 40, brand: 'Chaumet', name: '리앙 에비당스 (3mm DI)', material: '18K RG', priceSet: '₩300만', link: 'https://www.chaumet.com/kr_kr/bridal/women-wedding-bands', note: '로즈골드, 다이아, 매듭 모티프', images: ['쇼메 리앙 에비당스_3mm_di.png'], imgFit: 'product' },
  { id: 41, brand: 'Chaumet', name: '비 드 쇼메 (2.5mm)', material: '18K WG', priceSet: '₩179만', link: 'https://www.chaumet.com/kr_kr/bridal/women-wedding-bands', note: '벌집 모티프, 가장 저렴', images: ['쇼메 비 드 쇼메_2.5mm_di.png'], imgFit: 'product' },
  { id: 42, brand: 'Chaumet', name: '비 드 쇼메 (4mm DI)', material: '18K WG', priceSet: '₩368만', link: 'https://www.chaumet.com/kr_kr/bridal/women-wedding-bands', note: '벌집 모티프, 다이아, 볼드', images: ['쇼메 비 드 쇼메_4mm_di.png'], imgFit: 'product' },

  // Chanel
  { id: 16, brand: 'Chanel', name: '코코 크러쉬 웨딩밴드 (스몰)', material: 'PT950', priceSet: '₩259~389만', link: 'https://www.chanel.com/kr/fine-jewelry/bridal-exclusive-countries/c/3x2x10/', note: '퀼팅 모티프 · 기본 ₩259만 / DI ₩389만', images: ['샤넬 COCO Crush.png', '샤넬 COCO Crush_di.png'], imgFit: 'product' },
  { id: 17, brand: 'Chanel', name: '까멜리아 웨딩밴드', material: 'PT950', priceSet: '₩229만', link: 'https://www.chanel.com/kr/fine-jewelry/bridal-exclusive-countries/c/3x2x10/', note: '동백꽃 디테일', images: ['샤넬 Cameila.png'], imgFit: 'product' },
  { id: 18, brand: 'Chanel', name: '마틀라세 웨딩밴드', material: 'PT950', priceSet: '~₩430만', link: 'https://www.chanel.com/kr/fine-jewelry/bridal-exclusive-countries/c/3x2x10/', note: '넓은 퀼팅' },
  { id: 19, brand: 'Chanel', name: '프르미에르 프로메스 웨딩밴드', material: 'PT950', priceSet: '~₩420만', link: 'https://www.chanel.com/kr/fine-jewelry/bridal-exclusive-countries/c/3x2x10/', note: '한국/일본 한정' },

  // Bvlgari
  { id: 20, brand: 'Bvlgari', name: '마리미 웨딩밴드 (DI)', material: '18K RG / PT950', priceSet: '₩206~357만', link: 'https://www.bulgari.com/ko-kr/engagement-and-wedding/wedding-bands/', note: 'RG DI ₩206만 / RG 5DI ₩357만 / PT DI ₩330만', images: ['불가리 메리미_di.png', '불가리 메리미_di2.png', '불가리 메리미_di_플래티넘.png'], imgFit: 'slightLeftProduct' },
  { id: 21, brand: 'Bvlgari', name: '인피니토 웨딩밴드', material: 'PT950', priceSet: '₩260~306만', link: 'https://www.bulgari.com/ko-kr/engagement-and-wedding/wedding-bands/', note: '∞ 모티프 · 기본 ₩260만 / DI ₩306만', images: ['불가리 인피니토_플래티넘.png', '불가리 인피니토_플래티넘_di.png'], imgFit: 'slightLeftProduct' },
  { id: 22, brand: 'Bvlgari', name: '페디 웨딩밴드', material: 'PT950/18K', priceSet: '~₩330만', link: 'https://www.bulgari.com/ko-kr/engagement-and-wedding/wedding-bands/', note: '심플 클래식' },
  { id: 23, brand: 'Bvlgari', name: '로마 아모르 웨딩밴드', material: '18K RG/WG', priceSet: '₩289~309만', link: 'https://www.bulgari.com/ko-kr/engagement-and-wedding/wedding-bands/', note: 'RG ₩289만 / WG ₩309만', images: ['불가리 로마 아모르_로즈골드.png', '불가리 로마 아모르_화이트 골드.png'], imgFit: 'slightLeftProduct' },

  // Van Cleef & Arpels
  { id: 24, brand: 'Van Cleef & Arpels', name: '앙팡뜨리 웨딩밴드', material: 'PT950', priceSet: '~₩470만', link: 'https://www.vancleefarpels.com/kr/ko/collections/engagement/wedding-bands.html' },
  { id: 25, brand: 'Van Cleef & Arpels', name: '텐드르망 에또왈 웨딩밴드', material: 'PT950 / 18K RG', priceSet: '₩231~515만', link: 'https://www.vancleefarpels.com/kr/ko/collections/engagement/wedding-bands.html', note: 'RG DI ₩231만 / PT DI ₩515만', images: ['반 클리프 땅드레망 에또왈_로즈골드_di.png', '반 클리프 땅드레망 에또왈_플래티넘_di.png'], imgFit: 'slightLeftCenterProduct' },
  { id: 26, brand: 'Van Cleef & Arpels', name: '에스떼 웨딩밴드', material: 'PT950', priceSet: '~₩430만', link: 'https://www.vancleefarpels.com/kr/ko/collections/engagement/wedding-bands.html' },
  { id: 43, brand: 'Van Cleef & Arpels', name: '뚜쥬르 에또왈 웨딩밴드', material: 'PT950', priceSet: '₩515만', link: 'https://www.vancleefarpels.com/kr/ko/collections/engagement/wedding-bands.html', note: '다이아, 두꺼운 밴드', images: ['반 클리프 뚜쥬르 에또왈_플래티넘_di.png'], imgFit: 'slightLeftProduct' },

  // De Beers
  // De Beers — 이미지: 반지 상단, 영문 텍스트+가격 하단 → top crop
  { id: 27, brand: 'De Beers', name: 'DB Classic Half Eternity', material: 'PT950', priceSet: '$2,450', link: 'https://www.debeers.com/en-us/engagement-bridal/wedding-bands/', note: '커브드 하프 이터니티', images: ['드 비어스 DB Classic_플래티넘.png'], imgFit: 'flatProduct' },
  { id: 44, brand: 'De Beers', name: 'Aura Eternity Band', material: '18K WG', priceSet: '$2,000', link: 'https://www.debeers.com/en-us/engagement-bridal/wedding-bands/', note: '풀 이터니티 다이아', images: ['드 비어스 Aura_화이트골드.png'], imgFit: 'flatProduct' },
  { id: 45, brand: 'De Beers', name: 'Infinity Half Pavé Band', material: '18K RG/WG', priceSet: '$2,550', link: 'https://www.debeers.com/en-us/engagement-bridal/wedding-bands/', note: '인피니티 모티프, 하프 파베', images: ['드 비어스 Infinity_로즈골드.png', '드 비어스 Infinity_화이트골드.png'], imgFit: 'flatProduct' },
  { id: 53, brand: 'De Beers', name: 'Infinity Plain SM Band', material: '18K RG', priceSet: '$1,550', link: 'https://www.debeers.com/en-us/engagement-bridal/wedding-bands/', note: '인피니티 플레인, 심플', images: ['드 비어스 Infinity_로즈골드_di1.png'], imgFit: 'flatProduct' },
  { id: 46, brand: 'De Beers', name: 'Petal Band (화이트골드)', material: '18K WG', priceSet: '$3,000', link: 'https://www.debeers.com/en-us/engagement-bridal/wedding-bands/', note: '꽃잎 컷 다이아', images: ['드 비어스 Petal_화이트골드.png'], imgFit: 'flatProduct' },
  { id: 47, brand: 'De Beers', name: 'Petal Band (로즈골드)', material: '18K RG', priceSet: '$3,000', link: 'https://www.debeers.com/en-us/engagement-bridal/wedding-bands/', note: '꽃잎 컷 다이아, 로즈골드', images: ['드 비어스 Petal_로즈골드.png'], imgFit: 'flatProduct' },
  { id: 48, brand: 'De Beers', name: 'Channel-set Half Eternity', material: 'PT950', priceSet: '$2,550', link: 'https://www.debeers.com/en-us/engagement-bridal/wedding-bands/', note: '채널 세팅 하프 이터니티', images: ['드 비어스 Channel_화이트골드.png'], imgFit: 'flatProduct' },
  { id: 54, brand: 'De Beers', name: 'Caress Band', material: 'PT950', priceSet: '$1,900', link: 'https://www.debeers.com/en-us/engagement-bridal/wedding-bands/', note: '커브드 파베', images: ['드 비어스 Caress_플래티넘.png'], imgFit: 'flatProduct' },
  { id: 55, brand: 'De Beers', name: 'The Promise Half Pavé', material: '18K WG', priceSet: '$1,800', link: 'https://www.debeers.com/en-us/engagement-bridal/wedding-bands/', note: '크로스오버 하프 파베', images: ['드 비어스 The Promise_화이트골드.png'], imgFit: 'flatProduct' },
  { id: 28, brand: 'De Beers', name: '포에버마크 밴드', material: 'PT950', priceSet: '~₩450만', link: 'https://www.debeers.com/en-us/engagement-bridal/wedding-bands/' },
  { id: 29, brand: 'De Beers', name: 'DB 다를링 밴드', material: '18K RG', priceSet: '~₩420만', link: 'https://www.debeers.com/en-us/engagement-bridal/wedding-bands/' },

  // Tasaki
  { id: 30, brand: 'Tasaki', name: '피아노 밴드', material: 'PT950', priceSet: '~₩330만', link: 'https://www.tasaki.co.kr/bridal/wedding-bands/', note: '가장 인기 라인' },
  { id: 31, brand: 'Tasaki', name: '인피니타 밴드', material: 'PT950', priceSet: '~₩380만', link: 'https://www.tasaki.co.kr/bridal/wedding-bands/' },
  { id: 32, brand: 'Tasaki', name: '라벨로 밴드', material: 'PT950', priceSet: '~₩350만', link: 'https://www.tasaki.co.kr/bridal/wedding-bands/', note: '일본 구매 시 ~100만원 절감' },
  { id: 56, brand: 'Tasaki', name: '브릴란테 하프 이터니티 16', material: 'PT950', priceSet: '₩335만', link: 'https://www.tasaki.co.kr/bridal/wedding-bands/', note: '하프 이터니티 다이아', images: ['타사키 브릴란테_플래티넘_di_335백만원.png'], imgFit: 'product' },
  { id: 57, brand: 'Tasaki', name: '피아레체 하프 이터니티', material: '사쿠라골드', priceSet: '₩403만', link: 'https://www.tasaki.co.kr/bridal/wedding-bands/', note: '사쿠라골드(핑크), 다이아', images: ['타사키 피아레체 하프 이터니티_사쿠라골드_di_403백만원.png'], imgFit: 'product' },

  // Boucheron
  { id: 33, brand: 'Boucheron', name: '콰트로 클래식 웨딩밴드', material: '18K RG+PVD', priceSet: '₩325만', link: 'https://www.boucheron.com/ko/jewelry/bridal/wedding-bands.html', note: '로즈골드 + 블랙 PVD', images: ['부쉐린_콰트로 클래식 웨딩밴드_325만원.png'], imgFit: 'smallProduct' },
  { id: 34, brand: 'Boucheron', name: '콰트로 화이트 에디션', material: '18K WG', priceSet: '~₩470만', link: 'https://www.boucheron.com/ko/jewelry/bridal/wedding-bands.html' },
  { id: 35, brand: 'Boucheron', name: '콰트로 블랙 에디션', material: '18K WG+PVD', priceSet: '₩384만', link: 'https://www.boucheron.com/ko/jewelry/bridal/wedding-bands.html', note: '화이트골드 + 블랙 PVD', images: ['부쉐론 콰트로 블랙_384만원.png'], imgFit: 'smallProduct' },
  { id: 58, brand: 'Boucheron', name: '파셋 웨딩밴드', material: 'PT950', priceSet: '₩347만', link: 'https://www.boucheron.com/ko/jewelry/bridal/wedding-bands.html', note: '기하학 컷팅', images: ['부쉐론_파셋_플래티늄.png'], imgFit: 'product' },
  { id: 59, brand: 'Boucheron', name: '파셋 웨딩밴드 (DI)', material: 'PT950', priceSet: '₩420만', link: 'https://www.boucheron.com/ko/jewelry/bridal/wedding-bands.html', note: '기하학 컷팅, 다이아', images: ['부쉐론_파셋_플래티늄_di.png'], imgFit: 'product' },
  { id: 60, brand: 'Boucheron', name: '더블 고드롱 웨딩밴드', material: 'PT950', priceSet: '₩352만', link: 'https://www.boucheron.com/ko/jewelry/bridal/wedding-bands.html', note: '더블 그루브 클래식', images: ['부쉐론_더블 고드롤_플래티늄.png'], imgFit: 'product' },
  { id: 61, brand: 'Boucheron', name: '에퓨어 스몰 웨딩밴드', material: 'PT950', priceSet: '₩497만', link: 'https://www.boucheron.com/ko/jewelry/bridal/wedding-bands.html', note: '다이아 이터니티', images: ['부쉐론_에퓨어.png'], imgFit: 'product' },
  { id: 62, brand: 'Boucheron', name: '퐁 드 파리 웨딩밴드', material: 'PT950', priceSet: '₩535만', link: 'https://www.boucheron.com/ko/jewelry/bridal/wedding-bands.html', note: 'V자 다이아', images: ['부쉐론_퐁 드 파리.png'], imgFit: 'product' },

  // Piaget
  { id: 36, brand: 'Piaget', name: '포제션 DI 밴드 (스몰)', material: '18K RG/WG', priceSet: '$2,300~2,480', link: 'https://www.piaget.com/kr-ko/jewelry/wedding/wedding-rings', note: '회전밴드 · RG $2,300 / WG $2,480', images: ['피아제 Possession_로즈골드_di.png', '피아제 Possession_화이트골드_di.png'], imgFit: 'product' },
  { id: 37, brand: 'Piaget', name: '포제션 원포인트 다이아', material: '18K WG', priceSet: '~₩520만', link: 'https://www.piaget.com/kr-ko/jewelry/wedding/wedding-rings' },
  { id: 63, brand: 'Piaget', name: 'Limelight 웨딩링 (DI)', material: '18K RG', priceSet: '$2,890', link: 'https://www.piaget.com/kr-ko/jewelry/wedding/wedding-rings', note: '로즈골드, 하프 파베', images: ['피아제 Limelight_로즈골드.png'], imgFit: 'product' },
  { id: 64, brand: 'Piaget', name: 'Wedding Band (DI)', material: 'PT950', priceSet: '$3,150~3,250', link: 'https://www.piaget.com/kr-ko/jewelry/wedding/wedding-rings', note: '플래티넘 다이아 밴드', images: ['피아제 Wedding_플래티넘_1.png', '피아제 Wedding_플래티넘_2.png'], imgFit: 'product' },

  // Chopard
  { id: 38, brand: 'Chopard', name: '아이스큐브 퓨어 밴드', material: '18K RG/WG', priceSet: '~₩430만', link: 'https://www.chopard.com/ko-kr/jewellery-wedding-rings', note: '큐브 패턴, 1P DI', images: ['Chopard 아이스 큐브_로즈 골드.png', 'Chopard 아이스 큐브_화이트 골드.png'], imgFit: 'cleanProduct' },
  { id: 39, brand: 'Chopard', name: '아이스큐브 다이아 밴드', material: '18K WG', priceSet: '~₩510만', link: 'https://www.chopard.com/ko-kr/jewellery-wedding-rings', note: '다이아 세팅 큐브' },
];

export const ringTips = [
  '반드시 실물을 손에 직접 끼어봐야 함 (사진과 실물 느낌이 다름)',
  '남녀 디자인이 다르므로 둘이 함께 방문 권장',
  '종로 맞춤 vs 브랜드: 브랜드에서 산 커플이 오래 착용하는 경향이 있다는 후기 다수',
  '백화점 카드 할인(신세계/현대/롯데) 적용 시 10~15% 추가 절감',
];

