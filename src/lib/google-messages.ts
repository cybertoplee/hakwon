import { chromium, Browser, Page, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';

// Obfuscate path to prevent Next.js Turbopack from statically analyzing and bundling the storage directory, which causes symlink panic errors.
const STORAGE_DIR = ['s', 't', 'o', 'r', 'a', 'g', 'e'].join('');
const STORAGE_PATH = path.join(process.cwd(), STORAGE_DIR, 'google-messages-auth.json');
const USER_DATA_DIR = path.join(process.cwd(), STORAGE_DIR, 'playwright-profile');

/**
 * Google 메시지 웹 자동화 클래스
 */
export class GoogleMessagesAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private currentHeadless: boolean | null = null;

  /**
   * 브라우저 초기화 및 세션 로드
   */
  async init(headless: boolean = true) {
    // 기존 컨텍스트가 있지만 모드가 다른 경우 (예: headless -> headful) 닫고 다시 시작
    if (this.context && this.currentHeadless !== headless) {
      await this.close();
    }

    if (this.context) {
      try {
        // 컨텍스트가 연결되어 있고 페이지가 살아있는지 확인
        if (this.page && !this.page.isClosed()) {
          return;
        }
        console.log('[GoogleMessages] 기존 브라우저 세션이 끊겼거나 페이지가 닫혔습니다. 재시작 중...');
        await this.close();
      } catch (e) {
        await this.close();
      }
    }

    // 저장소 디렉토리 생성
    const storageDir = path.dirname(STORAGE_PATH);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const launchOptions = { 
      headless: headless !== undefined ? headless : this.currentHeadless,
      args: [
        '--window-size=960,800',
        '--window-position=100,100',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage', // 공유 메모리 부족 방지 (중요)
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-extensions',
        '--disable-notifications',
        '--mute-audio',
        '--disable-features=site-per-process', // OOM 방지
        '--disable-accelerated-2d-canvas',
        '--disable-accelerated-jpeg-decoding'
      ] 
    };

    try {
      // 시스템에 설치된 실제 Chrome을 우선 사용 시도 (안정성 및 드라이버 호환성 매우 높음)
      this.context = await chromium.launchPersistentContext(USER_DATA_DIR, { 
        ...launchOptions, 
        channel: 'chrome',
        viewport: { width: 960, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      });
      console.log('[GoogleMessages] System Chrome 런칭 성공 (Persistent Context).');
    } catch (chromeErr: any) {
      console.log('[GoogleMessages] System Chrome 런칭 실패, 기본 Chromium으로 폴백합니다.', chromeErr.message);
      this.context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        ...launchOptions,
        viewport: { width: 960, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      });
    }

    this.currentHeadless = headless;

    // 첫 번째 빈 페이지 활용 또는 새 페이지 생성
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
    this.page.setDefaultTimeout(60000);

    // 메모리 절약을 위한 리소스 차단 (OOM 크래시 방지)
    await this.page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // 페이지 충돌 리스너 추가
    this.page.on('crash', () => {
      console.error('[GoogleMessages] 페이지가 충돌했습니다 (Page crashed)');
      this.close();
    });

    // 기본 주소로 접속 (이미 로그인된 경우 대화 목록으로 바로 이동됨)
    await this.page!.goto('https://messages.google.com/web', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 웰컴 페이지가 뜨는 경우 '로그인' 버튼 클릭
    try {
      const loginButton = await this.page!.waitForSelector('a:has-text("로그인"), button:has-text("로그인")', { timeout: 5000 });
      if (loginButton) {
        console.log('[GoogleMessages] 웰컴 페이지 감지, 로그인 버튼 클릭 중...');
        await loginButton.click();
      }
    } catch (e) {
      // 웰컴 페이지가 아니면 무시하고 진행
    }

    // 웰컴 페이지나 로그인 유도 페이지인 경우만 처리
    try {
      if (this.page!.url().includes('welcome')) {
        const pairButton = await this.page!.$('button:has-text("기기 페어링"), a:has-text("기기 페어링"), [aria-label*="기기 페어링"]');
        if (pairButton) {
          await pairButton.click();
        } else {
          const loginButton = await this.page!.$('a:has-text("로그인"), button:has-text("로그인")');
          if (loginButton) await loginButton.click();
        }
        await this.page!.waitForLoadState('domcontentloaded');
      }

      // "여기에서 사용" 또는 "기기 페어링 해제" 관련 팝업 확인
      const useHereButton = await this.page!.$('button:has-text("여기에서 사용"), button:has-text("Use here")');
      if (useHereButton) {
        console.log('[GoogleMessages] "여기에서 사용" 버튼 클릭 중...');
        await useHereButton.click();
      }

      // "이 컴퓨터 기억하기" 또는 "Remember this computer" 토글/체크박스 자동 활성화
      try {
        const rememberToggle = await this.page!.$('mat-slide-toggle:has-text("기억"), mat-slide-toggle:has-text("Remember"), [aria-label*="기억"], [aria-label*="Remember"], button[role="switch"]:has-text("기억"), button[role="switch"]:has-text("Remember")');
        if (rememberToggle) {
          const isChecked = await rememberToggle.getAttribute('aria-checked');
          if (isChecked === 'false') {
            console.log('[GoogleMessages] "이 컴퓨터 기억하기" 토글 활성화 중...');
            await rememberToggle.click();
          }
        }
      } catch (e) {
        // 무시
      }
    } catch (err) {
      // 무시
    }
  }

  /**
   * QR 코드 스캔을 위한 헤드풀 브라우저 실행
   */
  async setupConnection() {
    try {
      console.log('[GoogleMessages] 연동 프로세스 시작...');
      await this.init(false); // UI가 보이도록 실행
      
      if (!this.page) throw new Error('브라우저 페이지를 초기화하지 못했습니다.');
      
      console.log('[GoogleMessages] 연동 상태 대기 중 (120초)...');
      
      // 로그인이 완료될 때까지 대기 (채팅 시작 버튼 또는 대화 목록이 보이면 성공)
      // 이미 페어링된 경우 즉시 성공 처리됨
      try {
        await this.page.waitForSelector('input[placeholder*="시작"], button:has-text("시작"), [aria-label*="시작"], .conversation-list, [role="grid"]', { timeout: 120000 });
      } catch (waitErr) {
        throw new Error('연동 확인 시간이 초과되었습니다. 브라우저 창에서 QR 스캔을 완료했는지 확인해 주세요.');
      }
      
      // Persistent context에서는 IndexedDB와 로컬스토리지가 자동 저장되므로 별도의 storageState 저장이 필요하지 않습니다.
      console.log('[GoogleMessages] 연동 성공 및 세션 저장 완료!');
      return { success: true };
    } catch (err: any) {
      console.error('[GoogleMessages] setupConnection 오류:', err);
      // 브라우저가 열리지 않는 경우 등을 대비해 에러 메시지 세분화
      const errorMessage = err.message || '알 수 없는 오류가 발생했습니다.';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 메시지 발송
   */
  async sendSMS(phoneNumber: string, message: string) {
    // 치명적 오류 확인 헬퍼
    const isFatal = (err: any) => err?.message?.includes('closed') || err?.message?.includes('crash') || err?.message?.includes('navigation');

    try {
      if (!this.page || this.page.isClosed()) await this.init(true);
      
      console.log(`[GoogleMessages] 메시지 발송 시작: ${phoneNumber}`);

      // 1. '채팅 시작' / '대화 시작' 버튼 탐색
      try {
        const startChatButton = this.page!.locator('button:has-text("시작"), a:has-text("시작"), [aria-label*="시작"], button:has-text("Start chat")').first();
        await startChatButton.waitFor({ state: 'visible', timeout: 5000 });
        await startChatButton.click({ timeout: 2000 });
      } catch (e: any) {
        if (isFatal(e)) throw e;
        // 실패 시 폴백: 'c' 키는 새 메시지 단축키이거나 탭 키로 이동
        await this.page!.keyboard.press('c');
      }
      
      // 2. 전화번호 입력창 입력
      await this.page!.waitForTimeout(500);
      const searchInput = await this.page!.locator('input[placeholder*="이름"], input[placeholder*="번호"], input[aria-label*="전화번호"], input[placeholder*="name"], input[placeholder*="number"]').first();
      await searchInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await searchInput.focus({ timeout: 2000 }).catch(() => {});
      await this.page!.keyboard.type(phoneNumber, { delay: 50 });
      await this.page!.waitForTimeout(500);
      
      // 검색 결과 확정 (번호 입력 후 아래 화살표 -> 엔터 -> 엔터)
      await this.page!.keyboard.press('ArrowDown');
      await this.page!.waitForTimeout(200);
      await this.page!.keyboard.press('Enter');
      await this.page!.waitForTimeout(500);
      await this.page!.keyboard.press('Enter');
      
      // 3. 메시지 입력창 대기 및 입력
      const msgInput = await this.page!.waitForSelector('textarea, div[role="textbox"][contenteditable="true"], .textarea', { timeout: 8000 });
      await msgInput.focus();
      
      // 빠른 fill() 시도 후 실패시 타이핑
      try {
        await msgInput.fill(message, { timeout: 2000 });
      } catch (e) {
        await this.page!.keyboard.type(message, { delay: 20 });
      }

      // 4. 전송 (Enter)
      await this.page!.waitForTimeout(500);
      await this.page!.keyboard.press('Enter');
      
      // 5. 전송 완료 확인을 위한 최소 대기 (3초 -> 1.5초)
      await this.page!.waitForTimeout(1500);
      
      console.log(`[GoogleMessages] 발송 명령 완료: ${phoneNumber}`);
      return { success: true };
    } catch (err: any) {
      console.error('[GoogleMessages] 발송 오류:', err.message || err);
      
      if (isFatal(err)) {
        console.log('[GoogleMessages] 치명적 오류로 세션 초기화');
        await this.close();
      }
      return { success: false, error: err.message || err };
    }
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.currentHeadless = null;
    }
  }
}

// Next.js 개발 환경에서 Hot Reload 시 인스턴스가 여러 개 생성되어
// 기존 브라우저 프로세스가 폴더 잠금을 유지하는 현상(EBUSY)을 방지하기 위한 글로벌 싱글톤 처리
const globalForGM = globalThis as unknown as { gmAutomation: GoogleMessagesAutomation };
export const gmAutomation = globalForGM.gmAutomation || new GoogleMessagesAutomation();

if (process.env.NODE_ENV !== 'production') {
  globalForGM.gmAutomation = gmAutomation;
}
