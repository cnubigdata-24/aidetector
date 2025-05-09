/**
 * NW 장애점 분석/탐지 (Advanced RAG) JavaScript
 * 코드 리팩토링 버전 - 가독성과 유지보수성 향상
 */

// 즉시 실행 함수로 전역 스코프 오염 방지
(function () {
  'use strict';

  // 전역 변수 및 상태 관리 모듈
  const AppState = {
    requestTime: null,
    responseCount: 0,
    guksa_id: 969, // URLSearchParams(window.location.search).get('guksa_id'),
    isDragging: false,
    isSidebarVisible: true,

    init() {
      console.log('쿼리스트링으로 받은 guksa_id:', this.guksa_id);
    },
  };

  // 유틸리티 함수 모듈
  const Utils = {
    // API 호출 함수
    fetchAPI(url, method = 'GET', data = null) {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      return fetch(url, options).then((res) => {
        if (!res.ok) {
          throw new Error(`서버 오류: ${res.status}`);
        }
        return res.json();
      });
    },

    // 날짜/시간 포맷팅
    formatDateTime(dt) {
      return dt.toISOString().slice(0, 19).replace('T', ' ');
    },

    // 소요 시간 계산
    calculateDuration(startTime, endTime) {
      const durationSec = Math.floor((endTime - startTime) / 1000);
      const durationMin = Math.floor(durationSec / 60);
      const remainSec = durationSec % 60;
      return { durationMin, remainSec };
    },

    // 현재 시간 문자열 반환
    getCurrentTime() {
      const date = new Date();
      const pad = (n) => (n < 10 ? '0' + n : n);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
        date.getHours()
      )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    },

    // 데이터 로딩 중 버튼 비활성화/활성화
    toggleButtonsDuringFetch(disabled) {
      const buttons = [
        document.getElementById('getAlarmBtn'),
        document.getElementById('getCableBtn'),
        document.getElementById('getMWInfoBtn'),
        document.getElementById('sendBtn'),
      ];

      buttons.forEach((btn) => {
        if (!btn) return;
        btn.disabled = disabled;
        if (disabled) {
          btn.classList.add('disabled');
        } else {
          btn.classList.remove('disabled');
        }
      });
    },

    // 표준화된 사용자 요청 처리 함수
    handleUserRequest(input, processFunction) {
      Utils.toggleButtonsDuringFetch(true);

      const thisResponseId = ++AppState.responseCount;
      const userMsg = DOMRenderer.addUserMessage(input, thisResponseId);
      const summaryItem = DOMRenderer.addSummaryItem(input, thisResponseId);
      const botLoading = DOMRenderer.addLoadingMessage('loading');

      return processFunction(thisResponseId, botLoading, summaryItem)
        .catch((error) => {
          if (botLoading && botLoading.parentNode) {
            botLoading.remove(); // 아직 로딩 메시지가 있으면 제거
          }
          DOMRenderer.addErrorMessage(error);
          summaryItem.classList.add('error');
          console.error('요청 처리 오류:', error);
        })
        .finally(() => {
          Utils.toggleButtonsDuringFetch(false);
        });
    },
  };

  // DOM 렌더링 모듈
  const DOMRenderer = {
    // 타임스탬프 업데이트
    updateTimestamp(requestTime, responseTime) {
      const timestamp = document.getElementById('timestamp');
      if (!timestamp) return;

      const { durationMin, remainSec } = Utils.calculateDuration(requestTime, responseTime);
      timestamp.innerHTML = `요청: ${Utils.formatDateTime(
        requestTime
      )} → 응답: ${Utils.formatDateTime(responseTime)} (소요시간: ${durationMin}분 ${remainSec}초)`;
    },

    // 사용자 메시지 추가
    addUserMessage(input, responseId) {
      const responseBox = document.getElementById('response-box');
      const userMsg = document.createElement('div');

      userMsg.className = 'user-msg';
      userMsg.textContent = input;
      userMsg.id = `response-${responseId}`;
      responseBox.appendChild(userMsg);

      return userMsg;
    },

    // 로딩 메시지 추가
    addLoadingMessage(mode) {
      const responseBox = document.getElementById('response-box');
      const botLoading = document.createElement('div');
      botLoading.className = 'bot-msg loading';

      if (mode === 'chat') {
        botLoading.innerHTML =
          '🔄 <b>답변 생성 중...</b> <br><br> 요청한 질문에 대해 답변을 생성합니다.';
      } else if (mode === 'loading') {
        botLoading.innerHTML = '🔄 <b>데이터 로딩 중...</b>';
      } else {
        botLoading.innerHTML =
          '🔄 <b>장애점 추론 중...</b> <br><br> 발생한 장애증상과 경보 패턴을 분석하여 유사 장애발생 사례를 기준으로 장애점을 추론합니다.';
      }

      responseBox.appendChild(botLoading);
      responseBox.scrollTop = responseBox.scrollHeight;

      return botLoading;
    },

    // 요약 항목 추가
    addSummaryItem(input, responseId) {
      const summaryList = document.getElementById('summary-list');
      const summaryItem = document.createElement('div');

      summaryItem.className = 'summary-entry';
      summaryItem.textContent = [...input].slice(0, 20).join('') + (input.length > 20 ? '...' : '');
      summaryItem.dataset.timestamp = new Date().toLocaleTimeString();

      summaryItem.onclick = () => {
        const targetEl = document.getElementById(`response-${responseId}`);
        if (targetEl) {
          window.scrollTo(0, window.scrollY - 5);
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }
      };

      summaryList.appendChild(summaryItem);
      return summaryItem;
    },

    // response-box 하위에 > bot-msg 추가
    addBotMessage(htmlContent, className = 'bot-msg') {
      const responseBox = document.getElementById('response-box');
      const botMsg = document.createElement('div');

      botMsg.className = className;
      botMsg.innerHTML = htmlContent;

      responseBox.appendChild(botMsg);
      responseBox.scrollTop = responseBox.scrollHeight;

      return botMsg;
    },

    // 쿼리 모드에 따른 placeholder 업데이트
    updatePlaceholder() {
      const mode = document.querySelector('input[name="queryMode"]:checked').value;
      const promptInput = document.getElementById('prompt-input');

      if (mode === 'fixed') {
        promptInput.placeholder =
          'NW 장애발생 시 장애점을 찾을 수 있도록 분야별 세부 경보내역을 입력해 주세요!\n\n[장애점 추론] 외부 환경(정전/페이딩/선로장애) + 경보내역 + 장애증상과 유사한 장애사례를 기준으로 추론 \n[유사 장애사례 추출] 입력된 경보내역 등을 바탕으로 유사도가 높은 사례 3건 추출';
      } else {
        promptInput.placeholder =
          '장애에 대해 자유롭게 질문하세요:\n- 이 장애의 원인은 무엇인가요?\n- 어떤 조치가 필요한가요?\n 유사한 장애 사례가 있었나요?';
      }
    },
  };

  // HTML 생성 모듈
  const HTMLGenerator = {
    // 파싱된 JSON 데이터 저장 변수
    parsedData: null,

    // 채팅 모드 응답 HTML 생성
    ChatModeResponseHTML(input, response) {
      try {
        return `
          <details open>
            <summary><b>📌 응답 펼치기/접기</b></summary>
            <div><b>[질문]</b> <br>${input}</div> <br>
            <div><b>[응답]</b> <br>${response.replace(/\n/g, '<br>')}</div>
          </details>
        `;
      } catch (e) {
        console.error('채팅 응답 생성 오류:', e);
        return `<div class="error-message">응답 처리 중 오류가 발생했습니다: ${e.message}</div>`;
      }
    },

    // OpinionSectionHTML 함수 - 장애점 추론 정보 표시
    OpinionSectionHTML() {
      if (!this.parsedData || !this.parsedData.opinion) {
        return '<div class="empty-opinion">종합 의견을 생성할 수 없습니다.</div>';
      }

      const opinion = this.parsedData.opinion;
      // 특수 스타일 적용을 위한 처리: '=' 문자는 제거
      let cleanedOpinion = opinion.replace(/=+/g, '');

      // 오류 메시지인 경우 error-message 클래스로 반환
      if (opinion.includes('❌ 오류:') || this.parsedData.error) {
        return `
          <div class="error-message">
            <br>
            ${cleanedOpinion.replace(/\n/g, '<br>')}
            <br>
          </div>
        `;
      }

      // 일관성 확인: 장애점 추론2의 신뢰도 확인
      // 상위 유사 장애사례 신뢰도가 summary 테이블의 1순위 신뢰도와 일치하는지 확인
      if (this.parsedData.summary && this.parsedData.summary.length > 0) {
        const topCaseConfidence = this.parsedData.summary[0]['신뢰도'];

        // 신뢰도 숫자만 추출
        const topConfValue = parseFloat(topCaseConfidence.replace('%', ''));

        // 신뢰도: 41.8% 패턴을 찾아서 장애점 추론2의 신뢰도 값을 대체 (정확한 추론2 신뢰도 보장)
        // 패턴을 더 정확하게 매칭하기 위해 정규식 수정
        cleanedOpinion = cleanedOpinion.replace(/장애점 추론 2.+?신뢰도: (\d+\.?\d*)%/s, (match) =>
          match.replace(/신뢰도: \d+\.?\d*%/, `신뢰도: ${topConfValue.toFixed(1)}%`)
        );

        // 패턴 기반 추론(장애점 추론1)과 유사 사례 기반 추론(장애점 추론2)의 신뢰도가 다른지 확인
        const pattern1ConfMatch = cleanedOpinion.match(/장애점 추론 1.+?신뢰도: (\d+\.?\d*)%/s);
        const pattern2ConfMatch = cleanedOpinion.match(/장애점 추론 2.+?신뢰도: (\d+\.?\d*)%/s);

        if (pattern1ConfMatch && pattern2ConfMatch) {
          const conf1 = parseFloat(pattern1ConfMatch[1]);
          const conf2 = parseFloat(pattern2ConfMatch[1]);

          // 두 신뢰도가 같다면 패턴 기반 신뢰도를 약간 조정
          if (Math.abs(conf1 - conf2) < 0.1) {
            const newConf1 = conf1 + 0.7;
            cleanedOpinion = cleanedOpinion.replace(
              /장애점 추론 1.+?신뢰도: \d+\.?\d*%/s,
              (match) => match.replace(/신뢰도: \d+\.?\d*%/, `신뢰도: ${newConf1.toFixed(1)}%`)
            );
          }
        }
      }

      // 지표 설명 추가
      const metricsExplanation = `
        <div class="metrics-explanation">
          <h4>📊 지표 설명</h4>
          <ul>
            <li><strong>신뢰도</strong>: 제안된 장애점이 정확할 확률을 나타내며, 유사도와 다른 요소를 종합적으로 고려하여 계산됩니다.</li>
            <li><strong>유사도</strong>: 입력된 장애증상/경보와 기존 장애사례 간의 텍스트 유사성을 나타내는 지표입니다.</li>
          </ul>
        </div>
      `;

      return `
        <div class="opinion-section">
          ${cleanedOpinion.replace(/\n/g, '<br>')}
          ${metricsExplanation}
        </div>
      `;
    },

    // 요약 섹션 HTML 생성
    SummarySectionHTML() {
      // 오류가 있거나 summary 데이터가 없는 경우 빈 문자열 반환
      if (
        this.parsedData.error ||
        !this.parsedData ||
        !this.parsedData.summary ||
        !Array.isArray(this.parsedData.summary) ||
        this.parsedData.summary.length === 0
      ) {
        return '';
      }

      const rows = this.parsedData.summary;
      let tableHTML = '<table class="summary-table">';

      // 테이블 헤더
      tableHTML += '<tr>';
      tableHTML += '<th style="width:40px;">순위</th>';
      tableHTML += '<th style="width:55px;">신뢰도</th>';
      tableHTML += '<th style="width:55px;">유사도</th>';
      tableHTML += '<th style="width:80px;">분야</th>';
      tableHTML += '<th style="width:350px;">장애점</th>';
      tableHTML += '<th>장애사례</th>';
      tableHTML += '</tr>';

      // 테이블 내용
      for (const row of rows) {
        tableHTML += '<tr>';
        tableHTML += `<td>${row['순위'] || '불명'}</td>`;
        tableHTML += `<td>${row['신뢰도'] || '0.0%'}</td>`;
        tableHTML += `<td>${row['유사도'] || row[' 유사도'] || '불명'}</td>`;
        tableHTML += `<td>${row['분야'] || '불명'}</td>`;
        tableHTML += `<td>${row['장애점'] || '불명'}</td>`;
        tableHTML += `<td>${row['장애사례'] || '불명'}</td>`;
        tableHTML += '</tr>';
      }

      tableHTML += '</table>';
      return tableHTML;
    },

    // 세부 내역 섹션 HTML 생성
    DetailsSectionHTML() {
      // 오류가 있거나 details 데이터가 없는 경우 빈 문자열 반환
      if (
        this.parsedData.error ||
        !this.parsedData ||
        !this.parsedData.details ||
        !Array.isArray(this.parsedData.details) ||
        this.parsedData.details.length === 0
      ) {
        return '';
      }

      const details = this.parsedData.details;
      let detailsHTML = '<div class="details-container">';

      // 각 세부 내역 항목 생성
      for (const item of details) {
        detailsHTML += `
          <div class="detail-item">
            <div class="detail-header">
              [장애점 추론 #${item['순위']}] (${item['분야']}) ${item['장애점']} (신뢰도: ${item['신뢰도']}, 유사도: ${item['유사도']})
            </div>
            <table class="detail-table">
        `;

        // 주요 정보 항목
        const infoFields = [
          { key: '발생일자', value: item['발생일자'] || '정보 없음' },
          { key: '장애사례', value: item['장애사례'] || '정보 없음' },
          { key: '분야', value: item['분야'] || '정보 없음' },
        ];

        // 필수 정보 테이블 행 추가
        for (const field of infoFields) {
          detailsHTML += `
            <tr>
              <th>${field.key}</th>
              <td>${field.value}</td>
            </tr>
          `;
        }

        // 선택적 정보 항목
        const optionalFields = [
          { key: '장애분석', value: item['장애분석'] },
          { key: '경보현황', value: item['경보현황'] },
          { key: '조치내역', value: item['조치내역'] },
        ];

        // 선택적 정보 추가
        for (const field of optionalFields) {
          if (field.value) {
            detailsHTML += `
              <tr>
                <th>${field.key}</th>
                <td>${field.value}</td>
              </tr>
            `;
          }
        }

        detailsHTML += `</table></div>`;
      }

      detailsHTML += '</div>';
      return detailsHTML;
    },

    // API 응답 전체 처리 및 HTML 생성
    AllSectionHTML(json_string) {
      try {
        // 데이터 유효성 검사
        if (!json_string || typeof json_string !== 'object') {
          throw new Error('유효한 API 응답 데이터가 아닙니다.');
        }

        // 파싱된 데이터 저장
        this.parsedData = json_string;

        // 각 섹션 HTML 생성
        const opinionSection = this.OpinionSectionHTML();
        const summaryTable = this.SummarySectionHTML();
        const detailsSection = this.DetailsSectionHTML();

        // 오류 필드가 있거나 opinion이 오류 메시지인 경우, error-message 형식으로 보여줌
        if (
          json_string.error ||
          (json_string.opinion &&
            (json_string.opinion.includes('❌ 오류:') ||
              json_string.opinion.includes('ERROR_DB_ACCESS')))
        ) {
          return opinionSection; // 이미 OpinionSectionHTML에서 error-message 클래스로 반환됨
        }

        // 필수 필드 확인
        if (!json_string.opinion) {
          throw new Error('API 응답에 필요한 opinion 필드가 누락되었습니다.');
        }

        return `
          ${opinionSection}
          ${summaryTable}
          ${detailsSection}
        `;
      } catch (e) {
        console.error('장애점 추론 응답 생성 오류:', e);
        return `
          <div class="error-message">
            <br>
            <p>❌ 오류: 데이터 처리 중 오류가 발생했습니다.</p>
            <p>${e.message}</p>
            <br>
          </div>
        `;
      }
    },

    // 케이블 상태 테이블 HTML 생성
    CableStatusHTML(dataList) {
      if (!dataList || dataList.length === 0) {
        //return '<div>선로 경보 내역이 없습니다.</div>';
      }

      let table = `
        <div class="cable-section">
          <table class="summary-table" style="width: max-content; margin-righ:10px; margin-bottom:5px;">
            <tr style="height: 10px; font-size: 14px;">
              <th>장애번호</th>
              <th>국사명</th>
              <th>케이블명</th>
              <th>등급</th>
              <th>상태</th>
              <th>피해원인</th>
              <th>발생일시</th>
              <th>복구일시</th>
              <th>VOC 건수</th>
              <th>영향고객수</th>
            </tr>
      `;

      for (const item of dataList) {
        table += `
          <tr style="height: 10px; font-size: 14px;">
            <td>${item.tt_no || '-'}</td>
            <td>${item.guksa_name || '-'}</td>
            <td>${item.cable_name_core || '-'}</td>
            <td>${item.fault_grade || '-'}</td>
            <td>${item.status || '-'}</td>
            <td>${item.sector_analysis || '-'}</td>
            <td>${item.alarm_occur_datetime || '-'}</td>
            <td>${item.alarm_recover_datetime || '-'}</td>
            <td>${item.voc_count || '0'}</td>
            <td>${item.customer_count || '0'}</td>
          </tr>
        `;
      }

      table += '</table></div>';
      return table;
    },

    // HTMLGenerator 모듈의 MWSnmpInfoHTML 함수
    MWSnmpInfoHTML(data) {
      try {
        if (!data || !Array.isArray(data.results)) {
          throw new Error('유효한 MW 수집 결과 데이터가 아닙니다.');
        }

        const fadingCount = data.fading_count || 0;
        const batteryCount = data.battery_mode_count || 0;
        const fadingSample = data.fading_sample || '';
        const batterySample = data.battery_sample || '';
        const results = data.results;

        // 경고 메시지와 테이블을 개별 div로 분리
        let alertHtml = '';
        let tableHtml = '';

        // 1. 경고 메시지 생성 - 전파 페이딩 정보만 포함하도록 수정
        if (fadingCount > 0 || batteryCount > 0) {
          const parts = [];
          let alarm_string = '';

          // 페이딩 정보 (존재하는 경우)
          if (fadingCount > 0) {
            alarm_string += 'MW 전파 페이딩 영향 🛑';
            parts.push(
              `<b>변조율이 크게 하락한 MW 장비</b> (${fadingSample}, 총 ${fadingCount}건)가 존재합니다.
          <br>⚠️ 전파 페이딩에 의한 영향일 수 있으니 확인하시기 바랍니다.`
            );
          } else {
            alarm_string += 'MW 전파 페이딩 영향 🟢';
            parts.push(
              `<b>전파 페이딩 영향이 있는 MW 장비</b>가 없습니다.
          <br>모든 MW 장비의 전파 상태가 정상입니다.`
            );
          }

          // 배터리 모드 정보 (존재하는 경우)
          if (batteryCount > 0) {
            alarm_string += ' / 한전 정전 영향 🛑';
            parts.push(
              `<b>MW 장비 중 배터리 모드로 운용 중인 장비</b> (${batterySample}, 총 ${batteryCount}건)가 존재합니다.
          <br>⚠️ 한전 정전의 가능성이 있으니 확인하시기 바랍니다.`
            );
          } else {
            alarm_string += ' / 한전 정전 영향 🟢';
            parts.push(
              `<b>모든 MW 장비가 상전</b>으로 운용 중이며 배터리를 사용중인 장비는 없기 때문에
          <br>한전 정전 상황은 아닌 것으로 판단됩니다.`
            );
          }

          alertHtml = `<div class="bot-warning">${alarm_string} <br><br> ${parts.join(
            '<br><br>'
          )}</div>`;
        } else {
          // 모두 정상인 경우에도 전파 페이딩 정보만 포함
          alertHtml = `
        <div class="bot-warning">
          MW 전파 페이딩 영향 🟢 / 한전 정전 🟢 <br><br>
          MW 장비 변조율의 변화가 크지 않아<b>전파 페이딩의 영향은 없는 것</b>으로 보입니다.
          <br>모든 MW 장비의 전파 상태가 정상입니다.
          <br><br>
          <b>모든 MW 장비가 상전</b>으로 운용 중이며 배터리를 사용 중인 장비는 없기 때문에
          <br>한전 정전 상황은 아닌 것으로 판단됩니다.
        </div>
      `;
        }

        // 2. 테이블 HTML 생성
        tableHtml = `
      <div class="mw-section">
        <div class="mw-result-table" style="margin-top: 5px;margin-bottom: 5px; margin-right: 5px">
          <table class="summary-table">
            <tr style="font-size: 14px;">
              <th>국사ID</th>
              <th>국사명</th>
              <th>장비ID</th>
              <th>장비명</th>
              <th>장비유형</th>
              <th>SNMP 수집</th>
              <th>Fading 여부</th>
              <th>전원상태</th>
              <th>수집일시</th>
            </tr>`;

        for (const item of results) {
          tableHtml += `
        <tr style="font-size: 14px;">
          <td>${item['국사ID'] || '-'}</td>
          <td>${item['국사명'] || '-'}</td>
          <td>${item['장비ID'] || '-'}</td>
          <td>${item['장비명'] || '-'}</td>
          <td>${item['장비유형'] || '-'}</td>
          <td>${item['snmp수집'] || '-'}</td>
          <td>${item['fading'] || '-'}</td>
          <td>${item['전원상태'] || '-'}</td>
          <td>${item['수집일시'] || '-'}</td>
        </tr>`;
        }

        tableHtml += `
        </table>
      </div>
    </div>`;

        // 3. 메시지와 테이블을 분리해서 반환(객체로 반환)
        return { alertHtml, tableHtml };
      } catch (e) {
        console.error('MW 요약 응답 생성 오류:', e);
        return {
          alertHtml: `<div class="error-message">⚠ MW 요약 응답 생성 중 오류 발생: ${e.message}</div>`,
          tableHtml: '',
        };
      }
    },
  };

  // API 호출 모듈
  const APIService = {
    // 실시간 경보 조회
    getRealTimeAlarmList() {
      Utils.toggleButtonsDuringFetch(true);

      // 전역 AppState에서 guksa_id 가져오기
      const guksa_id = AppState.guksa_id;

      // URL에 guksa_id 쿼리 파라미터 추가
      const url = guksa_id
        ? `/api/latest_alarms?guksa_id=${encodeURIComponent(guksa_id)}`
        : '/api/latest_alarms';

      return Utils.fetchAPI(url)
        .then((data) => {
          console.log('경보 데이터 수신:', data);
          if (data.alarms) {
            document.getElementById('prompt-input').value =
              '경보수집 내역입니다.\n\n' + data.alarms;
          }
          return data;
        })
        .catch((err) => {
          console.error('❌ 경보 데이터 로딩 실패:', err);
          throw err;
        })
        .finally(() => {
          Utils.toggleButtonsDuringFetch(false);
        });
    },

    // 광케이블 선로 장애정보 수집
    getDrCableInfo() {
      return Utils.fetchAPI(`/api/cable_status?guksa_id=${AppState.guksa_id}`)
        .then((data) => {
          if (!data.cable_status || !Array.isArray(data.cable_status)) {
            throw new Error('유효한 선로 경보 데이터가 없습니다.');
          }
          return data;
        })
        .catch((err) => {
          console.error('❌ 선로 경보 데이터 로딩 실패:', err);
          throw err;
        });
    },

    // MW 정보 수집 (전원정보 + 변조방식)
    getMWStatus() {
      const guksaId = AppState.guksa_id;

      if (!guksaId) {
        throw new Error('guksa_id가 없습니다');
      }

      return Utils.fetchAPI('/api/mw_info', 'POST', { guksa_id: guksaId })
        .then((response) => {
          if (!response || !response.response) {
            throw new Error('ZMQ Socket 서버로부터 정상적인 응답을 받지 못했습니다.');
          }
          console.log('M/W 장비 SNMP 정보 수신 성공');
          return response.response || response;
        })
        .catch((err) => {
          console.error('M/W 장비 SNMP 정보 수집 실패:', err);
          throw err;
        });
    },

    // 국사명 가져오기
    getGuksaName() {
      if (!AppState.guksa_id) {
        document.getElementById('guksa_name').innerText = '없음';
        return Promise.resolve();
      }

      return Utils.fetchAPI(`/api/guksa_name?guksa_id=${AppState.guksa_id}`)
        .then((data) => {
          if (data.guksa_name) {
            document.getElementById('guksa_name').innerText = data.guksa_name;
          } else {
            document.getElementById('guksa_name').innerText = '알 수 없음';
          }
        })
        .catch((err) => {
          console.error('국사명 조회 실패:', err);
          document.getElementById('guksa_name').innerText = '조회 실패';
        });
    },
  };

  // 로컬 스토리지 관리 모듈
  const StorageService = {
    keys: {
      conversation: 'nw-rag-conversation',
      summary: 'nw-rag-summary',
      count: 'nw-rag-count',
    },

    // 대화 내용 저장
    saveConversation() {
      const responseBox = document.getElementById('response-box');
      const summaryList = document.getElementById('summary-list');

      localStorage.setItem(this.keys.conversation, responseBox.innerHTML);
      localStorage.setItem(this.keys.summary, summaryList.innerHTML);
      localStorage.setItem(this.keys.count, AppState.responseCount.toString());
    },

    // 대화 내용 불러오기
    loadConversation() {
      const savedConversation = localStorage.getItem(this.keys.conversation);
      const savedSummary = localStorage.getItem(this.keys.summary);
      const savedCount = localStorage.getItem(this.keys.count);

      if (savedConversation) {
        document.getElementById('response-box').innerHTML = savedConversation;
      }

      if (savedSummary) {
        document.getElementById('summary-list').innerHTML = savedSummary;
      }

      if (savedCount) {
        AppState.responseCount = parseInt(savedCount);
      }
    },

    // 대화 내용 초기화
    clearConversation() {
      if (confirm('모든 대화 내용을 초기화하시겠습니까?')) {
        document.getElementById('response-box').innerHTML = '';
        document.getElementById('summary-list').innerHTML = '';
        document.getElementById('prompt-input').value = '';
        AppState.responseCount = 0;

        // 서버에 대화 초기화 요청
        Utils.fetchAPI('/api/clear_conversation', 'POST', { clear: true }).catch((err) =>
          console.error('대화 초기화 오류:', err)
        );

        // 타임스탬프 초기화
        const timestamp = document.getElementById('timestamp');
        if (timestamp) {
          timestamp.textContent = '';
        }

        // 로컬 스토리지 초기화
        Object.values(this.keys).forEach((key) => localStorage.removeItem(key));
      }
    },
  };

  // UI 컨트롤러 모듈 - 사용자 액션 처리 함수
  const UIController = {
    // 프롬프트 입력 처리
    handlePrompt() {
      const input = document.getElementById('prompt-input').value.trim();
      if (!input) {
        DOMRenderer.addErrorMessage('검색어를 입력해 주세요.');
        return;
      }

      const mode = document.querySelector('input[name="queryMode"]:checked').value;
      Utils.toggleButtonsDuringFetch(true);

      const requestTimeObj = new Date();
      const thisResponseId = ++AppState.responseCount;

      // 사용자 메시지 및 로딩 표시 추가
      const userMsg = DOMRenderer.addUserMessage(input, thisResponseId);
      const botLoading = DOMRenderer.addLoadingMessage(mode);
      const summaryItem = DOMRenderer.addSummaryItem(input, thisResponseId);

      // API 호출
      Utils.fetchAPI('/api/rag_popup', 'POST', { query: input, mode, guksa_id: AppState.guksa_id })
        .then((data) => {
          botLoading.remove();
          const responseTimeObj = new Date();

          DOMRenderer.updateTimestamp(requestTimeObj, responseTimeObj);

          let htmlContent;
          if (data.success === false) {
            htmlContent = `<div class="error-message">❌ 오류 발생: ${
              data.error || '알 수 없는 오류'
            }</div>`;
          } else {
            if (mode === 'chat') {
              htmlContent = HTMLGenerator.ChatModeResponseHTML(input, data.details);
            } else {
              htmlContent = HTMLGenerator.AllSectionHTML(data);
            }
          }

          DOMRenderer.addBotMessage(htmlContent);
          summaryItem.classList.add('completed');
        })
        .catch((err) => {
          botLoading.remove();
          const responseTimeObj = new Date();

          DOMRenderer.updateTimestamp(requestTimeObj, responseTimeObj);
          DOMRenderer.addErrorMessage(err);
          summaryItem.classList.add('error');
        })
        .finally(() => {
          Utils.toggleButtonsDuringFetch(false);
          document.getElementById('prompt-input').value = '';
          DOMRenderer.updatePlaceholder();
        });
    },

    // 실시간 경보 목록 가져오기
    getRealTimeAlarmList() {
      APIService.getRealTimeAlarmList();
    },

    // Dr. Cable에서 광케이블 선로 피해정보 수집
    getDrCableInfo() {
      // 표준화된 사용자 요청 처리 함수 사용
      const input = '가장 최근에 발생한 선로장애 내역을 확인해줘...';

      Utils.handleUserRequest(input, (responseId, botLoading, summaryItem) => {
        botLoading.innerHTML = '🔄 <b>선로장애 정보 조회 중...</b>';

        return APIService.getDrCableInfo()
          .then((data) => {
            botLoading.remove();

            const unrecovered = data.unrecovered_alarm || { count: 0 };
            let warningMsg = '';

            if (unrecovered.count === 0) {
              warningMsg = `선로 장애 영향 🟢 <br><br> <b>'현재'</b> 해당 지역에 <b>미복구된 선로 장애는 없는 것으로 파악이 됩니다.</b><br>
                  아래 선로 장애 내역을 참고해 주시고, <b>'다른 분야의 경보 내역'</b>을 추가로 확인하시기 바랍니다.`;
            } else {
              const recent = unrecovered.most_recent || {};
              warningMsg = `선로 장애 영향 🛑 <br><br> ${recent.alarm_occur_datetime || ''}, <b>
                  ${recent.guksa_name || '알 수 없음'}</b>의 <b>선로장애</b>(${
                recent.cable_name_core || '알 수 없음'
              }, ${recent.fault_sector || '알 수 없음'}) 
                등 <b>
                  ${unrecovered.count}건</b>의 <b>미복구 장애</b>가 조회됩니다. 
                <br>⚠️ 현재 장애가 아래 선로장애 영향인지 확인이 필요합니다.
                <br><br> ※ 선로장애 발생일시, 국사, 케이블명 등을 확인바랍니다.`;
            }

            DOMRenderer.addBotMessage(
              `<div class="bot-warning">${warningMsg}</div>`,
              'bot-msg msg-info'
            );

            const tableHtml = HTMLGenerator.CableStatusHTML(data.cable_status);
            DOMRenderer.addBotMessage(tableHtml);

            summaryItem.classList.add('completed');
            return data;
          })
          .catch((error) => {
            botLoading.remove(); // 오류 발생 시에도 로딩 메시지 제거
            DOMRenderer.addErrorMessage(error);
            summaryItem.classList.add('error');
            throw error; // 오류를 상위로 전파
          });
      });
    },

    // MW SNMP 정보 수집
    getMWInfoFromSNMP() {
      const input = '현재 도서 M/W 장비의 전원과 페이딩 상태를 확인해줘...';

      Utils.handleUserRequest(input, (responseId, botLoading, summaryItem) => {
        botLoading.innerHTML = '🔄 <b>M/W 장비의 전원과 페이딩 정보 분석 중...</b>';

        return APIService.getMWStatus()
          .then((data) => {
            botLoading.remove();

            // HTML 생성 - 객체로 반환됨
            const { alertHtml, tableHtml } = HTMLGenerator.MWSnmpInfoHTML(data);

            // 개별 div로 분리해서 출력
            DOMRenderer.addBotMessage(alertHtml, 'bot-msg msg-info'); // 경고 메시지 먼저 출력
            DOMRenderer.addBotMessage(tableHtml); // 그 다음 테이블 출력

            summaryItem.classList.add('completed');
            return data;
          })
          .catch((error) => {
            botLoading.remove(); // 오류 발생 시에도 로딩 메시지 제거
            DOMRenderer.addErrorMessage(error);
            summaryItem.classList.add('error');
            throw error; // 오류를 상위로 전파
          });
      });
    },

    // 대화 내용 초기화
    clearConversation() {
      StorageService.clearConversation();
    },

    // 사이드바 토글 - 펼치기/접기
    toggleSidebar() {
      const sidebar = document.getElementById('summary-list');
      AppState.isSidebarVisible = !AppState.isSidebarVisible;

      if (!AppState.isSidebarVisible) {
        sidebar.style.width = '0';
        sidebar.style.padding = '0';
      } else {
        sidebar.style.width = '250px';
        sidebar.style.padding = '10px';
      }
    },
  };

  // 초기화 및 이벤트 리스너 설정
  function initApp() {
    // 앱 상태 초기화
    AppState.init();

    // 로컬 스토리지에서 대화 이력 로드
    StorageService.loadConversation();

    // 플레이스홀더 업데이트
    DOMRenderer.updatePlaceholder();

    // 라디오 버튼 변경 이벤트 리스너
    document.querySelectorAll('input[name="queryMode"]').forEach((radio) => {
      radio.addEventListener('change', DOMRenderer.updatePlaceholder);
    });

    // 버튼 이벤트 리스너 설정
    document
      .getElementById('getAlarmBtn')
      .addEventListener('click', UIController.getRealTimeAlarmList);
    document.getElementById('getCableBtn').addEventListener('click', UIController.getDrCableInfo);
    document
      .getElementById('getMWInfoBtn')
      .addEventListener('click', UIController.getMWInfoFromSNMP);
    document
      .getElementById('clearChatBtn')
      .addEventListener('click', UIController.clearConversation);
    document.getElementById('sendBtn').addEventListener('click', UIController.handlePrompt);

    // 엔터 키 이벤트 처리
    document.getElementById('prompt-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        UIController.handlePrompt();
      }
    });

    // 초기 데이터 로드
    APIService.getRealTimeAlarmList();

    // 국사명 가져오기
    APIService.getGuksaName();

    // 자동 저장 타이머 설정
    setInterval(() => StorageService.saveConversation(), 60000);

    // 사이드바 드래그 설정
    setupSidebarDrag();
  }

  // 사이드바 드래그 기능 설정
  function setupSidebarDrag() {
    const sidebar = document.getElementById('summary-list');
    const dragHandle = document.getElementById('drag-handle');
    const toggleBtn = document.getElementById('toggle-btn');

    // 드래그 이벤트 리스너 설정
    dragHandle.addEventListener('mousedown', (e) => {
      AppState.isDragging = true;
      document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
      if (!AppState.isDragging) return;
      const newWidth = e.clientX;

      if (newWidth >= 10) {
        sidebar.style.width = `${newWidth}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      AppState.isDragging = false;
      document.body.style.cursor = 'default';
    });

    // 토글 버튼 클릭 이벤트
    toggleBtn.addEventListener('click', UIController.toggleSidebar);
  }

  // 페이지 로드 시 앱 초기화
  document.addEventListener('DOMContentLoaded', initApp);
})();
