
/**
 * 한글 초성 추출 유틸리티
 */
export const getChosung = (str: string) => {
  const CHO = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 44032;
    if (code > -1 && code < 11172) result += CHO[Math.floor(code / 588)];
    else result += str.charAt(i);
  }
  return result;
};

/**
 * 초성 검색 포함 여부 확인
 */
export const matchChosung = (target: string, query: string) => {
  if (!query) return true;
  const targetChosung = getChosung(target);
  const queryChosung = getChosung(query);
  
  // 쿼리가 초성만으로 이루어져 있는지 확인
  const isOnlyChosung = /^[\u3131-\u314E\s]+$/.test(query);
  
  if (isOnlyChosung) {
    return targetChosung.includes(query);
  }
  
  return target.includes(query) || targetChosung.includes(queryChosung);
};
