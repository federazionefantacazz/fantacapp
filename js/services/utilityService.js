export const fitText = (element, maxFontSize = 1.7, minFontSize = 0.95) => {
  if (!element) return;
  
  let currentSize = maxFontSize;
  element.style.fontSize = `${currentSize}rem`;
  element.style.whiteSpace = 'nowrap';

  const parentWidth = element.parentElement ? element.parentElement.clientWidth : element.clientWidth;

  while (element.scrollWidth > parentWidth && currentSize > minFontSize) {
    currentSize -= 0.05;
    element.style.fontSize = `${currentSize}rem`;
  }

  if (element.scrollWidth > parentWidth) {
    element.style.overflow = 'hidden';
    element.style.textOverflow = 'ellipsis';
  }
};
