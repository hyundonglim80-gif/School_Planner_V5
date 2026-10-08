// 글 속의 웹 주소(http://, https://)를 누를 수 있는 링크로 보인다 (V4 lib/textUtils renderFormattedText).
// 보여 주기만 바꾼다 - 글은 그대로다(읽기·저장 길에서 본문을 바꾸지 않는다).
// 사이트·지도 미리보기 카드(LinkPreviewCards)는 P4-2.
const URL_RE = /(https?:\/\/[^\s]+)/g;

export default function FormattedText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        // split의 괄호 묶음 덕에 홀수 자리가 주소다
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            data-text-link
            className="text-blue-600 hover:text-blue-800 underline font-semibold break-all inline-flex items-center gap-0.5 mx-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <span aria-hidden>🔗</span>
            <span>{part.length > 40 ? part.substring(0, 37) + '...' : part}</span>
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
