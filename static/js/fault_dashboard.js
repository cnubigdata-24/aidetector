/**
 * 경보 대시보드 시스템: 주요 기능: 분야별 경보 표시, 데이터 필터링, 테이블 정렬, 국사/장비 기준 뷰 등
 */

// 🚩 🔴 🟡 🟢 🔵 🔘 🔥 ⚠️ 🚨 🔔 ☑️ ✅ ✔️ ⚡ 🔥 💡 ✨ 🎯 📊 ❌ ⏱️ 🧭 🗺️ 🔄 ⏳ 📌 🗂️ �� 💬 🗨️ ▶️ ⏹️

// 상태 변수들
let _totalAlarmDataList = []; // 원본 데이터 보존용 (API로부터 받은 원래 데이터)
let _selectedSector = 'IP'; // 디폴트 분야 IP
let _selectedView = 'equip'; // 현재 뷰 (장비 기준 또는 국사 기준)
let _currentPage = 1; // 현재 페이지

let _summaryAlarmData = []; // 요약 경보 데이터
let _allEquipmentData = []; // 모든 장비 데이터

// DOM 요소 선택 유틸리티 함수 => 미사용 삭제 예정 To do List ########################
const DOM = {
  dashboard: () => d3.select('#dashboard'),
  mapContainer: () => document.getElementById('map-container'),
  alarmTableBody: () => document.getElementById('alarmTableBody'),
  searchGuksa: () => document.getElementById('searchGuksa'),
  searchEquipName: () => document.getElementById('searchEquipName'),
  timeFilter: () => document.getElementById('timeFilter'),
  pagination: () => $('#pagination'),
  leftSidebar: () => document.querySelector('.left-sidebar'),
  hamburgerBtn: () => document.getElementById('hamburger-btn'),
  equipViewBtn: () => document.getElementById('equip-view-btn'),
  guksaViewBtn: () => document.getElementById('guksa-view-btn'),
  recentUpdateTime: () => document.getElementById('recent-update-time'),
};

// 초기화 함수
function initDashboard() {
  const dashboard = d3.select('#dashboard');
  dashboard.html(''); // 기존 내용 삭제

  // 가로 배열을 위해 바로 6개 분야를 추가 - 전역 변수 사용
  const sectors = window.SECTORS || ['MW', '선로', '전송', 'IP', '무선', '교환'];

  // 분야별 색상 정보 가져오기 (fault_d3_map.js의 COLORS 상수 사용)
  const getSectorColor = (sector) => {
    if (window.COLORS && window.COLORS.SECTOR && window.COLORS.SECTOR[sector]) {
      return window.COLORS.SECTOR[sector].FILL;
    }
    // 기본 색상 정의 (COLORS가 로드되지 않은 경우)
    const defaultColors = {
      MW: '#ffaa00',
      선로: '#ff8833',
      전송: '#ff66cc',
      IP: '#ff3333',
      무선: '#ffcc66',
      교환: '#cc0000',
    };
    return defaultColors[sector] || '#cccccc';
  };

  sectors.forEach((sector) => {
    const sectorColor = getSectorColor(sector);

    dashboard
      .append('div')
      .attr('class', 'dashboard-box draggable')
      .attr('data-sector', sector)
      .attr('draggable', 'true').html(`
        <h3>
          <span class="sector-color-indicator" style="
            display: inline-block;
            width: 10px;
            height: 10px;
            background-color: ${sectorColor};
            border: 1px solid #666;
            margin-right: 6px;
            vertical-align: baseline;
            border-radius: 2px;
            position: relative;
            top: -1px;
          "></span>
          ${sector} 분야
        </h3>
        <div class="dashboard-content">
          <div>· 경보 장비: <span class="equip-count">0대</span></div>
          <div>· 전체 경보: <span class="alarm-count">0개</span></div>
          <div>· 유효 경보: <span class="valid-count">0개 (0%)</span></div>
        </div>
      `);
  });

  // 클릭 이벤트 연결
  initDashboardClickEvents();
}

/**
 * 이벤트 핸들러 초기화 함수들
 */

// Sidebar Sector 라디오 버튼 이벤트 설정
function initSectorRadioEvent() {
  const sectorRadios = document.querySelectorAll('input[name="sector"]');

  sectorRadios.forEach((radio) => {
    radio.addEventListener('change', function () {
      if (this.checked) {
        const selectedSector = this.value;
        console.log(`Radio 버튼 변경: ${selectedSector} 분야`);

        // 분야 변경 시 채팅창에 안내 메시지 추가
        let previousSector = _selectedSector;
        addChatMessage(
          `✅ <strong>분야가 변경되었습니다.</strong> (${previousSector} → ${selectedSector})`,
          'system',
          false
        );

        // 현재 필터링 분야 설정
        _selectedSector = selectedSector;

        // 테이블 검색 필터 초기화 (분야 변경 시)
        if (typeof window.clearTableSearchFilter === 'function') {
          window.clearTableSearchFilter();
        }

        // 장비 목록 업데이트
        fetchSideBarEquipListBySector(_selectedSector);

        // 해당 dashboard-box에 선택 효과 적용
        document
          .querySelectorAll('.dashboard-box')
          .forEach((el) => el.classList.remove('selected'));
        const boxEl = document.querySelector(`.dashboard-box[data-sector="${_selectedSector}"]`);
        if (boxEl) {
          boxEl.classList.add('selected');
        }

        // 맵 초기화 - 현재 뷰에 맞는 기본 메시지 표시
        changeMapText(_selectedView);

        // 테이블 데이터 새로고침
        refreshAlarmTable();
      }
    });
  });
}

// 대시보드 박스 클릭 이벤트
function initDashboardClickEvents() {
  d3.selectAll('.dashboard-box').on('click', function () {
    const sector = d3.select(this).attr('data-sector');

    _selectedSector = sector;
    console.log(`대시보드 박스 클릭: ${_selectedSector} 분야`);

    // 테이블 검색 필터 초기화 (분야 변경 시)
    if (typeof window.clearTableSearchFilter === 'function') {
      window.clearTableSearchFilter();
    }

    // SideBar 라디오 버튼 Sector 값 동기화
    const radio = document.querySelector(`input[name="sector"][value="${_selectedSector}"]`);
    if (radio) {
      radio.checked = true;
    }

    // SideBar 장비 목록도 해당 Sector로 업데이트
    fetchSideBarEquipListBySector(_selectedSector);

    // 분야별 대시보드 UI 하이라이트: 선택된 박스 강조
    document.querySelectorAll('.dashboard-box').forEach((el) => el.classList.remove('selected'));
    this.classList.add('selected');

    console.log(`필터 적용: ${_selectedSector} 분야만 표시`);

    // 맵 초기화 - 현재 뷰에 맞는 기본 메시지 표시
    changeMapText(_selectedView);

    // 경보 테이블 데이터 새로고침
    refreshAlarmTable();
  });
}

// 경보 테이블 row 클릭 이벤트 설정 함수
function setupTableRowClick() {
  const tBody = document.getElementById('alarmTableBody');

  tBody.addEventListener('click', function (event) {
    // 행 엘리먼트 찾기
    const row = event.target.closest('tr');
    if (!row) return;

    // 행에서 국사 ID 추출
    const guksaId = row.getAttribute('data-guksa-id');
    // 행에서 장비 ID 추출 (equip_id 열에서 가져옴)
    const equipIdCell = row.querySelector('.col-equip-id');
    const equipId = equipIdCell ? equipIdCell.textContent.trim() : '';

    if (!guksaId) {
      console.error('행에 guksa_id 속성이 설정되어 있지 않습니다.');
      return;
    }

    console.log(`선택한 국사 ID: ${guksaId}, 장비 ID: ${equipId}, 현재 뷰: ${_selectedView}`);

    // ===== 새로 추가된 부분 =====
    // 테이블 행 클릭 시 채팅창 초기화
    // 장비명 찾기
    const equipNameCell = row.querySelector('.col-equip-name');
    const equipName = equipNameCell ? equipNameCell.textContent.trim() : '';

    // 경보 데이터 객체 추출
    const alarm = _totalAlarmDataList.find((d) => d.equip_id === equipId);

    console.log(
      `▶▶▶ handleEquipChangeEvent 분야: _selectedView => ${_selectedView}, equipSector =>${alarm.equipSector}, 유형 ${alarm.equipType}) 장비명: ${equipName} 장비ID: ${equipId} 국사ID: ${guksaId}`
    );

    if (_selectedView === 'equip') {
      handleEquipChangeEvent({
        equipName: equipName || '테이블에서 선택된 장비',
        equipId: equipId,
        equipSector: alarm?.sector || '확인 X',
        equipType: alarm?.equip_type || '확인 X',

        guksaName: alarm?.guksa_name || '확인 X',
        guksaId: guksaId,
      });
    }

    // 통합 함수 호출 - 현재 뷰에 따라 다른 모드로 실행

    if (_selectedView === 'equip') {
      fetchEquipmentData({
        guksaId: guksaId,
        equipId: equipId,
        viewType: _selectedView,
      });
    } else {
      fetchEquipmentData({
        guksaId: guksaId,
        viewType: _selectedView,
      });
    }
  });
}

// 상단 Equip, Guksa 장비/국사 기준 토글 버튼 초기화 및 이벤트 설정
function setToggleViewButtons() {
  try {
    const equipViewBtn = document.getElementById('equip-view-btn');
    const guksaViewBtn = document.getElementById('guksa-view-btn');

    if (!equipViewBtn || !guksaViewBtn) {
      console.error('뷰 전환 버튼을 찾을 수 없습니다.', { equipViewBtn, guksaViewBtn });
      return;
    }

    console.log('현재 선택된 뷰:', _selectedView);
    console.log('버튼 상태 초기화 전:', {
      equipActive: equipViewBtn.classList.contains('active'),
      guksaActive: guksaViewBtn.classList.contains('active'),
    });

    // 초기 상태 설정 - _selectedView 값에 따라 설정
    if (_selectedView === 'equip') {
      equipViewBtn.classList.add('active');
      guksaViewBtn.classList.remove('active');
    } else {
      equipViewBtn.classList.remove('active');
      guksaViewBtn.classList.add('active');
    }

    console.log('버튼 상태 초기화 후:', {
      equipActive: equipViewBtn.classList.contains('active'),
      guksaActive: guksaViewBtn.classList.contains('active'),
    });

    // 이벤트 핸들러 설정 - 일관성을 위해 직접 함수를 할당
    equipViewBtn.onclick = function () {
      console.log('장비 기준 버튼 클릭됨');
      switchView('equip');
    };

    guksaViewBtn.onclick = function () {
      console.log('국사 기준 버튼 클릭됨');
      switchView('guksa');
    };

    console.log('뷰 전환 버튼 이벤트 설정 완료');
  } catch (error) {
    console.error('뷰 전환 버튼 설정 중 오류 발생:', error);
  }
}

// 장비/국사 Equip, Guksa View 전환 함수
function switchView(viewType) {
  console.log(`${viewType} 기준 버튼 클릭, 현재 뷰:`, _selectedView);

  // 뷰가 변경되면 경보 테이블 업데이트
  if (_selectedView !== viewType) {
    _selectedView = viewType;
    console.log(`뷰 변경 완료: _selectedView = ${_selectedView}`);

    const equipViewBtn = document.getElementById('equip-view-btn');
    const guksaViewBtn = document.getElementById('guksa-view-btn');

    if (!equipViewBtn || !guksaViewBtn) {
      console.error('버튼 요소를 찾을 수 없습니다.');
      return;
    }

    console.log('버튼 상태 변경 전:', {
      equipActive: equipViewBtn.classList.contains('active'),
      guksaActive: guksaViewBtn.classList.contains('active'),
    });

    if (viewType === 'equip') {
      equipViewBtn.classList.add('active');
      guksaViewBtn.classList.remove('active');
    } else {
      equipViewBtn.classList.remove('active');
      guksaViewBtn.classList.add('active');

      window.clearChatMessages();
    }

    console.log('버튼 상태 변경 후:', {
      equipActive: equipViewBtn.classList.contains('active'),
      guksaActive: guksaViewBtn.classList.contains('active'),
    });

    // 대시보드 표시 - 명시적 호출
    changeMapText(_selectedView);

    console.log(`뷰 전환 완료: ${_selectedView} 기준, Sector 분야: ${_selectedSector || '없음'}`);
  } else {
    console.log(`이미 ${_selectedView} 기준으로 설정되어 있습니다.`);
  }
}

function changeMapText(viewType) {
  console.log(`changeMapText 실행, 뷰 타입: ${viewType}`);

  const isEquipView = viewType === 'equip';
  const mapContainer = document.getElementById('map-container');

  if (!mapContainer) {
    console.error('맵 컨테이너 요소를 찾을 수 없습니다.');
    return;
  }

  // 맵 컨테이너 표시
  mapContainer.style.display = 'block';

  // 뷰 타입에 따라 다른 메시지 표시
  const instructionMessage = isEquipView
    ? '✔️ [장비 기준] 왼쪽 경보 장비나 아래 경보 내역 클릭 시 → 연결된 모든 장비들의 경보 표시'
    : '✔️ [국사 기준] 왼쪽 경보 장비나 아래 경보 내역 클릭 시 → 동일 국사에 수용된 장비들의 경보 표시';

  console.log(`맵 컨테이너 메시지 설정: "${instructionMessage}"`);

  // 안전한 방식으로 innerHTML 업데이트
  try {
    mapContainer.innerHTML = '<div class="instruction-message">' + instructionMessage + '</div>';

    console.log('맵 컨테이너 텍스트 업데이트 완료');
  } catch (error) {
    console.error('맵 컨테이너 텍스트 업데이트 중 오류:', error);
  }
}

// Sector 분야별 장비 목록 api 호출/업데이트 (/api/equipment_by_sector)
async function fetchSideBarEquipListBySector(sector) {
  console.log(`분야별 장비 목록 업데이트 시작: ${sector}`);

  try {
    const guksaSelect = document.getElementById('searchGuksa');
    const guksaId = guksaSelect ? guksaSelect.value : '';

    // API 호출 데이터 준비
    const requestData = {
      sector: sector,
    };

    // 국사가 선택된 경우 추가
    if (guksaId) {
      requestData.guksa_id = guksaId;
    }

    // API 호출
    const data = await callApi('/api/equipment_by_sector', requestData);
    if (!data) {
      throw new Error('장비 목록 데이터를 가져오지 못했습니다.');
    }

    console.log('View 모드:', _selectedView);
    console.log('장비 목록 데이터:', data);

    // 새로운 필터 시스템에 데이터 설정 (기존 코드 대체)
    setAllEquipmentList(data || []);
  } catch (error) {
    console.error('장비 목록 가져오기 오류:', error);
    //showErrorMessage('장비 목록을 가져오는 중 오류가 발생했습니다.');
  }
}

function refreshPage() {
  location.reload();
}

// 경보 현황 alarm_dashboard API 호출 (항상 모든 분야 all로 호출 => /api/alarm_dashboard)
async function fetchAllAlarmsFromDB(isSectorFilterMode = false) {
  try {
    showTableErrorMessage('⏱️ 데이터를 불러오는 중입니다...');

    // 검색 파라미터 가져오기, 항상 모든 분야 all로 호출
    const guksa_id = document.getElementById('searchGuksa').value;
    const sectors = ['all'];
    const timeFilter = document.getElementById('timeFilter').value;

    let equip_name = '';
    if (isSectorFilterMode) {
      equip_name = document.getElementById('searchEquipName').value;
    }

    // 요청 객체 생성
    const requestData = {
      guksa_id, // 선택된 국사 ID (값이 있으면 특정 국사, 없으면 전체 국사)
      sectors,
      equip_name,
      timeFilter,
    };

    console.log('경보 데이터 요청:', requestData);

    // API 호출 - 오류 방지를 위한 재시도 로직 추가
    let responseData = null;
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries) {
      responseData = await callApi('/api/alarm_dashboard', requestData);
      if (responseData && (responseData.alarms || Array.isArray(responseData))) {
        break; // 데이터가 있으면 재시도 중단
      }
      retries++;
      console.log(`API 재시도 ${retries}/${maxRetries}`);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 대기
    }

    // 응답 데이터 처리
    if (responseData && typeof responseData === 'object') {
      // 원본 데이터 저장
      if ('alarms' in responseData) {
        _totalAlarmDataList = Array.isArray(responseData.alarms) ? [...responseData.alarms] : [];

        console.log(`원본 데이터 ${_totalAlarmDataList.length}개 항목 저장 완료`);

        // 최근 경보 시간 업데이트
        if (responseData.recent_update_time) {
          updateRecentUpdateTime(responseData.recent_update_time);
        }
      } else {
        _totalAlarmDataList = Array.isArray(responseData) ? [...responseData] : [];
      }
    } else {
      console.warn('유효한 경보 데이터를 받지 못했습니다');
      _totalAlarmDataList = [];
    }

    // 요약 데이터는 모든 데이터 사용
    _summaryAlarmData = [..._totalAlarmDataList];

    // 페이지 초기화
    _currentPage = 1;
    _selectedSector = getCurrentSectorFromUI();

    // 대시보드는 항상 모든 데이터로 업데이트
    updateAlarmSummary(_summaryAlarmData);

    // 테이블은 현재 필터로 업데이트 - 지연시켜 실행
    setTimeout(() => {
      refreshAlarmTable();
    }, 100);
  } catch (error) {
    console.error('경보 데이터 가져오기 오류:', error);
    _totalAlarmDataList = [];
    _summaryAlarmData = [];

    showTableErrorMessage(`데이터를 가져오는 중 오류가 발생했습니다: ${error.message}`);
    updateAlarmSummary(_summaryAlarmData);
  }
}

// UI에서 현재 선택된 분야 가져오기
function getCurrentSectorFromUI() {
  const sectorRadio = document.querySelector('input[name="sector"]:checked');
  return sectorRadio ? sectorRadio.value : '';
}

// 하단 경보 테이블 업데이트 함수
function refreshAlarmTable() {
  console.log('> 경보 테이블 업데이트 시작...');
  console.log(`> Sector 분야: "${_selectedSector}"`);

  // 테이블 초기화
  try {
    // 기존 테이블 Resizer 해제
    if (window.tableResizer) {
      window.tableResizer.dispose();
      delete window.tableResizer;
    }
  } catch (e) {
    console.warn('테이블 Resizer 해제 오류:', e);
  }

  // 전역 경보 데이터 여부 체크
  if (!_totalAlarmDataList || _totalAlarmDataList.length === 0) {
    console.warn('원본 데이터가 없습니다.');
    showTableErrorMessage(
      '❌ 경보 데이터가 없습니다. 실시간 경보 수집 버튼을 눌러 데이터를 가져오세요.'
    );
    return;
  }

  // 전역 경보 데이터를 Sector로 필터링
  console.log(`분야 필터 적용: ${_selectedSector}`);
  let filteredData = _totalAlarmDataList.filter(
    (item) => item && item.sector && item.sector.toLowerCase() === _selectedSector.toLowerCase()
  );

  // 필터링 결과 데이터 없을 경우 처리
  if (!filteredData || filteredData.length === 0) {
    console.log(`"${_selectedSector}" 분야의 데이터가 없습니다.`);
    showTableErrorMessage(`"${_selectedSector}" 분야의 데이터가 없습니다.`);
    DOM.pagination().empty();

    return;
  }

  // 페이지네이션 렌더링
  renderPagination(filteredData.length);

  // 페이지 데이터 안전하게 가져오기
  const result = getPageDataSafely(filteredData, '경보 테이블');

  if (result.success) {
    console.log('▶▶ addRowsToAlarmTable 호출 시작');
    console.log('▶▶ addRowsToAlarmTable에 pageData 입력:', result.data);

    // 테이블 내용 업데이트 - setTimeout으로 지연시켜 렌더링 이슈 방지
    setTimeout(() => {
      addRowsToAlarmTable(result.data);
    }, 100);
  } else {
    console.log('=========현재 페이지에 표시할 데이터가 없습니다.=========');
    console.log('filteredData:', filteredData);

    showTableErrorMessage('❌ ' + result.message);
  }

  console.log(
    `> 경보 테이블 업데이트 완료: ${filteredData.length}개 항목, 현재 페이지: ${_currentPage}`
  );

  // 컬럼 리사이즈 기능 초기화
  if (typeof initTableColumnResize === 'function') {
    initTableColumnResize();
  }
}

// 하단 경보 테이블에 실제 데이터 Row추가
function addRowsToAlarmTable(alarmDataList) {
  console.log('addRowsToAlarmTable 함수 실행: 실제 경보 테이블에 데이터를 추가');
  const tBody = document.getElementById('alarmTableBody');

  if (!tBody) {
    console.error('테이블 본문 요소를 찾을 수 없습니다.');
    return;
  }

  tBody.innerHTML = '';

  if (!Array.isArray(alarmDataList) || alarmDataList.length === 0) {
    showTableErrorMessage('데이터가 없습니다');
    return;
  }

  // 유효경보 표시 준비
  const validCounts = {};
  const sectors = window.SECTORS || ['MW', '선로', '전송', 'IP', '무선', '교환'];
  sectors.forEach((sector) => {
    validCounts[sector] = 0;
  });

  // 테이블 행 생성
  alarmDataList.forEach((item) => {
    if (!item) return;

    const row = document.createElement('tr');

    // 각 row에 guksa_id 데이터를 속성으로 추가
    row.setAttribute('data-guksa-id', item.guksa_id || '');

    // 유효경보인 경우 row에 style이 적용된 클래스로 설정
    if (item.valid_yn === 'Y') {
      row.classList.add('valid-alarm');
      if (item.sector && sectors.includes(item.sector)) {
        validCounts[item.sector] += 1;
      }
    }

    // 국사 이름
    let guksaName = item.guksa_name || '-';

    // 테이블 셀 생성
    const cells = [
      { value: guksaName, className: 'col-guksa', title: item.guksa_id },
      { value: item.sector || '-', className: 'col-sector' },
      { value: item.valid_yn === 'Y' ? '유효' : '무효', className: 'col-valid' },
      { value: formatDateTime(item.occur_datetime), className: 'col-occur-time' },
      { value: item.equip_id || '', className: 'col-equip-id' },
      { value: item.equip_type || '-', className: 'col-equip-type' },
      { value: item.equip_name || '-', className: 'col-equip-name' },
      { value: item.alarm_message || '-', className: 'col-alarm-message' },
    ];

    cells.forEach((cell) => {
      const td = document.createElement('td');
      td.className = cell.className;
      td.textContent = cell.value;

      if (cell.title) {
        td.title = cell.title;
      }

      row.appendChild(td);
    });

    tBody.appendChild(row);
  });

  // Sector 분야별 대시보드 박스 글자 색상 업데이트 (유효 경보 강조)
  sectors.forEach((sector) => {
    if (validCounts[sector] > 0) {
      const box = document.querySelector(`.dashboard-box[data-sector="${sector}"]`);
      if (box) {
        box.classList.add('has-valid-alarms');
      }
    }
  });

  // 테이블 필터 추가 (테이블이 업데이트될 때마다 필터가 있는지 확인하고 없으면 추가)
  const table = document.getElementById('alarmTable');
  if (table && typeof addTableSearchFilters === 'function') {
    // 기존 필터가 있는지 확인
    const existingFilter = table
      .closest('.table-container')
      ?.querySelector('.table-filter-container');
    if (!existingFilter) {
      console.log('[TableFilter] 테이블 필터 추가');
      addTableSearchFilters(table);
    }
  }

  // 컬럼 리사이즈 기능 초기화
  if (typeof initTableColumnResize === 'function') {
    initTableColumnResize();
  }
}

// 상단 경보 요약 대시보드 업데이트
function updateAlarmSummary() {
  // 분야별 데이터 집계
  const summary = {};
  const sectors = window.SECTORS || ['MW', '선로', '전송', 'IP', '무선', '교환'];
  sectors.forEach((sector) => {
    summary[sector] = [];
  });

  // 분야별 데이터 분류
  if (Array.isArray(_summaryAlarmData)) {
    _summaryAlarmData.forEach((item) => {
      if (item && item.sector && sectors.includes(item.sector)) {
        if (!summary[item.sector]) {
          summary[item.sector] = [];
        }
        summary[item.sector].push(item);
      }
    });
  }

  // 전체 현황 계산
  let totalEquipmentCount = 0;
  let totalAlarmCount = 0;
  let totalValidCount = 0;

  // 각 분야별 현황 합산
  sectors.forEach((sector) => {
    const items = summary[sector] || [];
    const validAlarms = items.filter((d) => d.valid_yn === 'Y').length;
    const uniqueEquipmentCount = new Set(items.map((d) => d.equip_name)).size;

    totalEquipmentCount += uniqueEquipmentCount;
    totalAlarmCount += items.length;
    totalValidCount += validAlarms;
  });

  // 전체 현황 업데이트
  const elements = {
    equipmentCount: document.getElementById('total-equip-count'),
    alarmCount: document.getElementById('total-alarm-count'),
    validCount: document.getElementById('total-valid-count'),
  };

  if (elements.equipmentCount) {
    elements.equipmentCount.textContent = `| 실시간 경보장비  ${formatNumber(
      totalEquipmentCount
    )}대`;
  }

  if (elements.alarmCount) {
    elements.alarmCount.textContent = `| 전체 경보  ${formatNumber(totalAlarmCount)}개`;
  }

  if (elements.validCount) {
    //     elements.validCount.textContent = `유효 경보(${formatNumber(totalValidCount)}개)`;
  }

  // 분야별 대시보드 업데이트
  updateDashboardSector(summary);
}

// 상단 분야별 경보 대시보드 업데이트
function updateDashboardSector(summary) {
  console.log('분야별 대시보드 업데이트 시작');

  const sectors = window.SECTORS || ['MW', '선로', '전송', 'IP', '무선', '교환'];
  sectors.forEach((sector) => {
    const box = d3.select(`[data-sector="${sector}"]`);

    // 박스가 존재하지 않으면 스킵
    if (box.empty()) {
      console.warn(`분야 [${sector}]에 해당하는 대시보드 요소가 없습니다.`);
      return;
    }

    const items = summary[sector] || [];

    // 유효 경보 수 계산
    const validAlarms = items.filter((d) => d.valid_yn === 'Y').length;
    const totalAlarms = items.length;
    const validPercentage = totalAlarms > 0 ? Math.round((validAlarms / totalAlarms) * 100) : 0;

    // 고유 장비 수 계산
    const uniqueEquipmentCount = new Set(items.map((d) => d.equip_name)).size;

    // 대시보드 숫자 출력
    box.select('.equip-count').text(`${uniqueEquipmentCount}대`);
    box.select('.alarm-count').text(`${totalAlarms}개`);

    // 유효 경보 텍스트 출력
    const percentText = validPercentage === 100 ? '100%' : `${validPercentage}%`;
    const validText = `${validAlarms}개 (${percentText})`;

    const validCountSpan = box.select('.valid-count');
    if (!validCountSpan.empty()) {
      validCountSpan.text(validText);
    } else {
      box
        .select('.dashboard-content')
        .append('div')
        .html(`· 유효 경보: <span class="valid-count">${validText}</span>`);
    }

    // 하이라이트 스타일 적용
    if (validAlarms > 0) {
      box.classed('has-valid-alarms', true);
      box.select('h3').style('color', '#ff8c00');
      box.select('.valid-count').classed('highlight-valid', true);
    } else {
      box.classed('has-valid-alarms', false);
      box.select('h3').style('color', '#333');
      box.select('.valid-count').classed('highlight-valid', false);
    }

    console.log(
      `${sector} 분야 대시보드: 장비 ${uniqueEquipmentCount}대, 전체 ${totalAlarms}개, 유효 ${validAlarms}개 (${validPercentage}%)`
    );
  });
}

// 맵 관련 통합 함수들
// 장비 조회 api 호출 및 맵 표시 (통합 함수: /api/alarm_dashboard_equip, /api/get_equiplist)
async function fetchEquipmentData(options = {}) {
  const {
    guksaId = '',
    equipId = '',
    equipName = document.getElementById('searchEquipName').value || '',
  } = options;

  console.log(`장비 데이터 조회: ${_selectedView} 기준, 국사=${guksaId}, 장비ID=${equipId}`);

  if (!guksaId && !equipId) {
    console.error('국사 ID 또는 장비 ID 중 하나는 필요합니다.');
    showMapErrorMessage('국사 또는 장비 정보가 필요합니다.');
    return;
  }

  try {
    // API 요청 구성
    let apiParams = { guksa_id: guksaId };

    let loadingMessage = '';
    let apiEndpoint = '';

    if (_selectedView === 'equip') {
      // 장비 기준 뷰인 경우 추가 파라미터
      loadingMessage = '장비 연결 데이터 로딩 중...';
      apiEndpoint = '/api/alarm_dashboard_equip';

      apiParams.sectors = ['all']; // 장비 기준은 항상 'all'로 호출
      apiParams.equip_name = equipName;
      apiParams.equip_id = equipId;
    } else {
      // 국사 기준 뷰 모드인 경우 (국사 id가 왜 없지?) ################################## To do list
      loadingMessage = '국사 장비 데이터 로딩 중...';
      apiEndpoint = '/api/get_equiplist';
    }

    // 맵 컨테이너에 로딩 표시
    showMapLoadingMessage(loadingMessage);

    // API 호출
    const responseData = await callApi(apiEndpoint, apiParams);
    if (!responseData) {
      throw new Error('유효한 데이터를 받지 못했습니다.');
    }

    // 데이터 형식 변환
    const formattedData = formatEquipmentData(responseData, guksaId, _selectedView);
    if (!formattedData) {
      throw new Error('데이터 변환 실패');
    }

    let equipList = [];
    if (_selectedView === 'equip') {
      equipList = formattedData.equipment_list;
    } else {
      equipList = formattedData.equip_list;
    }

    // 데이터가 비어있는지 확인
    if (!equipList || equipList.length === 0) {
      showMapErrorMessage('표시할 장비 토폴로지 데이터가 없습니다.');
      return;
    }

    // 맵 생성
    createMapTotal(formattedData, _selectedView);

    // UI 동기화
    syncUIWithFilterState();

    // ===== 새로 추가된 부분 =====
    // 맵 로딩 완료 시 채팅창에 안내 메시지 추가

    let tempEquipList = [];

    if (_selectedView === 'equip') {
      tempEquipList = formattedData.equipment_list;

      setTimeout(() => {
        const message = generateMapCompletionMessage(tempEquipList, formattedData);
        addChatMessage(message, 'alarm', true);
      }, 200);
    } else {
      // 국사인 경우 generateMapCompletionMessage 이 함수 호출이 필요한가? ########## To do list
      //tempEquipList = formattedData.equip_list;
    }
  } catch (error) {
    console.error(`장비 정보 조회 오류:`, error);

    showMapErrorMessage(`장비 정보 조회 오류: ${error.message}`);
    syncUIWithFilterState();
  }
}

// 맵 완성 메시지 생성 함수
function generateMapCompletionMessage(equipList, mapData) {
  if (_selectedView !== 'equip') return;

  // 안전한 배열 접근을 위한 검증
  const safeEquipList = equipList && Array.isArray(equipList) ? equipList : [];
  const equipCount = safeEquipList.length;

  // 장비 분야 정보를 빠르게 조회하기 위한 맵 생성
  const equipFieldMap = {};
  safeEquipList.forEach((equip) => {
    const equipId = equip.equip_id || equip.id;
    equipFieldMap[equipId] = equip.equip_field;
  });

  // 경보 발생 장비 계산 (기존 로직 유지)
  let equipWithAlarms = 0;
  equipWithAlarms = safeEquipList.filter((equip) => {
    if (equip.alarms && Array.isArray(equip.alarms) && equip.alarms.length > 0) {
      return true;
    }
    if (_totalAlarmDataList && Array.isArray(_totalAlarmDataList)) {
      const hasAlarmInGlobal = _totalAlarmDataList.some(
        (alarm) => alarm && alarm.equip_id === (equip.equip_id || equip.id)
      );
      return hasAlarmInGlobal;
    }
    return false;
  }).length;

  // 선로 정보 계산
  const links = mapData && mapData.links ? mapData.links : [];
  let alarmCableLinks = 0;
  let totalCableLinks = 0;
  let alarmMwLinks = 0;
  let totalMwLinks = 0;

  if (Array.isArray(links)) {
    links.forEach((link) => {
      const sourceId =
        link.equip_id || (typeof link.source === 'object' ? link.source.id : link.source);
      const targetId =
        link.link_equip_id || (typeof link.target === 'object' ? link.target.id : link.target);

      let sourceField = link.sourceField;
      let targetField = link.targetField;

      if (!sourceField && sourceId) {
        sourceField =
          equipFieldMap[sourceId] ||
          (_totalAlarmDataList && Array.isArray(_totalAlarmDataList)
            ? _totalAlarmDataList.find((alarm) => alarm.equip_id === sourceId)?.sector
            : undefined);
      }

      if (!targetField && targetId) {
        targetField =
          equipFieldMap[targetId] ||
          (_totalAlarmDataList && Array.isArray(_totalAlarmDataList)
            ? _totalAlarmDataList.find((alarm) => alarm.equip_id === targetId)?.sector
            : undefined);
      }

      const isCableLink =
        sourceField === '선로' ||
        targetField === '선로' ||
        (link.link_name && link.link_name.trim() !== '');

      if (isCableLink) {
        totalCableLinks++;
        if (_totalAlarmDataList && Array.isArray(_totalAlarmDataList)) {
          const hasAlarm = _totalAlarmDataList.some(
            (alarm) => alarm && (alarm.equip_id === sourceId || alarm.equip_id === targetId)
          );
          if (hasAlarm) {
            alarmCableLinks++;
          }
        }
      }

      if (sourceField === 'MW' && targetField === 'MW') {
        totalMwLinks++;
      }
    });
  }

  // 🚀 장비 기준 뷰인 경우 => 우측 채팅창에 장애 의심 상위 장비 찾기
  const suspiciousEquips = [];

  if (
    window.currentRootCauseResults &&
    window.currentRootCauseResults.nodeNames &&
    Array.isArray(window.currentRootCauseResults.nodeNames) &&
    window.currentRootCauseResults.nodeNames.length > 0
  ) {
    // ✅ 이미 분석된 결과를 다시 직접 사용
    suspiciousEquips.push(...window.currentRootCauseResults.nodeNames);
    console.log('전역변수 장애의심 상위 장비 결과 사용:', suspiciousEquips);
  } else {
    console.log('전역변수 장애의심 상위 장비 결과가 없어 fallback 로직 사용할 필요가 없음');
  }

  // 메시지 생성 (기존과 동일)
  let message = `<strong>📌 NW 토폴로지와 상위장비 장애 정보가 생성되었습니다.</strong><br>`;
  message += `&nbsp;&nbsp;• 경보 장비: ${equipWithAlarms}대 경보 발생 (전체 ${equipCount}대)<br>`;
  message += `&nbsp;&nbsp;• 선로 장애: Dr.Cable 장애 ${alarmCableLinks}건 발생 (전체 ${totalCableLinks}건)<br>`;
  message += `&nbsp;&nbsp;• 페이딩 MW: 페이딩 0건 추정 (전체 ${totalMwLinks}건)<br>`;

  if (suspiciousEquips.length > 0) {
    message += `<span style="color: red;">&nbsp;&nbsp;• 장애 의심 상위 장비 (${
      suspiciousEquips.length
    }대)<br>&nbsp;&nbsp;&nbsp;&nbsp; ${suspiciousEquips.join(', ')}</span><br>`;
  } else {
    message += `&nbsp;&nbsp;• 장애 의심 상위 장비 (0대): 없음<br>`;
  }

  message += `<br>💡 <a href="#" onclick="handleFaultPointClick()">장애점 찾기</a>를 클릭하여 분석을 시작하세요.`;

  return message;
}

// UI를 필터 상태와 동기화
function syncUIWithFilterState() {
  // 라디오 버튼 동기화
  if (_selectedSector) {
    const radio = document.querySelector(`input[name="sector"][value="${_selectedSector}"]`);
    if (radio && !radio.checked) {
      radio.checked = true;
    }

    // 대시보드 박스 선택 상태 업데이트
    d3.selectAll('.dashboard-box').classed('selected', false);
    const boxEl = d3.select(`.dashboard-box[data-sector="${_selectedSector}"]`);
    if (!boxEl.empty()) {
      boxEl.classed('selected', true);
    }
  } else {
    // 필터링 없는 경우는 모든 대시보드 박스 선택 해제
    d3.selectAll('.dashboard-box').classed('selected', false);

    // 라디오 버튼도 모두 선택 해제
    document.querySelectorAll('input[name="sector"]').forEach((radio) => {
      radio.checked = false;
    });
  }

  console.log('UI 상태 동기화 완료: 분야=', _selectedSector);
}

// 장비 데이터 형식 통합 변환 함수
function formatEquipmentData(responseData, guksaId = '', selectedView = 'equip') {
  if (!responseData) {
    console.warn('장비 데이터가 없습니다');
    return null;
  }

  // 기본 결과 객체 초기화
  const result = {
    guksa_id: responseData.guksa_id || guksaId || '',
    guksa_name: responseData.guksa_name || '알 수 없음',
  };

  // 장비 목록 필드 찾기
  const equipListFieldNames = ['equip_list', 'equipment_list', 'nodes', 'equipments'];
  let equipListData = null;

  // 데이터가 배열인 경우 직접 사용
  if (Array.isArray(responseData)) {
    equipListData = responseData;
  } else {
    // 객체에서 적절한 장비 목록 필드 찾기
    for (const fieldName of equipListFieldNames) {
      if (responseData[fieldName] && Array.isArray(responseData[fieldName])) {
        equipListData = responseData[fieldName];
        break;
      }
    }
  }

  // 장비 목록 필드가 없으면 빈 배열로 초기화
  if (!equipListData) {
    equipListData = [];
  }

  // equip 뷰인 경우 => equip과 link 데이터 모두 포함
  if (selectedView === 'equip') {
    result.equipment_list = equipListData;

    // 네트워크 링크 데이터 찾기
    const linkFieldNames = ['links', 'edges', 'connections'];
    let linkData = [];

    if (!Array.isArray(responseData)) {
      for (const fieldName of linkFieldNames) {
        if (responseData[fieldName] && Array.isArray(responseData[fieldName])) {
          linkData = responseData[fieldName];
          break;
        }
      }
    }

    result.links = linkData;
  } else {
    result.equip_list = equipListData;
  }

  return result;
}

// 맵 생성 통합 함수 (createEquipTopologyMap, createGuksaTopologyMap)
function createMapTotal(responseData, selectedView = 'equip') {
  let mapFunction;

  if (selectedView === 'equip') {
    mapFunction = window.createEquipTopologyMap;
  } else {
    mapFunction = window.createGuksaTopologyMap;
  }

  if (typeof mapFunction === 'function') {
    // 맵 함수 존재 확인
    try {
      mapFunction(responseData, _totalAlarmDataList);
    } catch (error) {
      console.error('맵 생성 오류:', error);
      showMapErrorMessage(`맵 생성 오류: ${error.message}`);
    }
  } else {
    // 함수가 없는 경우 오류 메시지 표시
    let functionName;
    let errorMsg;

    if (selectedView === 'equip') {
      functionName = 'createEquipTopologyMap';
      errorMsg = '장비 네트워크 맵을 표시할 수 없습니다. 관련 스크립트를 확인하세요.';
    } else {
      functionName = 'createGuksaTopologyMap';
      errorMsg = '국사 장비 맵을 표시할 수 없습니다. 관련 스크립트를 확인하세요.';
    }

    console.error(`${functionName} 함수를 찾을 수 없습니다.`);

    showMapErrorMessage(errorMsg);
  }
}

/**
 * 국사 목록 및 기타 이벤트 처리
 */

// 국사 목록 조회 api 호출 (/api/guksa_list)
async function fetchGuksaList() {
  try {
    const response = await fetch('/api/guksa_list');
    if (!response.ok) {
      throw new Error('서버 응답 오류: ' + response.status);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('형식 오류: 배열이 아님');
    }

    // 국사 선택 드롭다운 업데이트
    const select = document.getElementById('searchGuksa');
    if (!select) return;

    data.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.guksa_id;

      // 자국 표시가 있는 경우 추가
      let text = item.guksa_name;
      if (item.guksa_type === '자국') {
        text += ' (자국)';
      }

      option.textContent = text;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('국사 목록 로드 실패:', error);
  }
}

// Sidebar 장비 변경 이벤트
function equipChangeEventHandler() {
  const equipSelect = document.getElementById('searchEquipName');

  console.log('장비 선택 이벤트 리스너 추가');

  equipSelect.addEventListener('change', function (event) {
    console.log('장비 선택 change 이벤트 발생!');

    // 선택된 장비의 정보 가져오기
    const selectedIndex = event.target.selectedIndex;
    console.log(`선택된 인덱스: ${selectedIndex}`);

    if (selectedIndex < 0) {
      console.warn('유효한 인덱스가 선택되지 않았습니다.');

      return;
    }

    const selectedOption = this.options[selectedIndex];
    const equipId = selectedOption.dataset.equipId;
    const equipName = this.value;

    let guksaId = document.getElementById('searchGuksa').value || '';

    if (!equipId) {
      console.warn('장비 ID가 없습니다. 장비를 다시 선택해주세요.');
      return;
    }
    if (!equipName) {
      console.warn('장비명이 선택되지 않았습니다.');
      return;
    }

    // ✅ equipId로부터 경보 데이터 객체 추출
    const alarm = _totalAlarmDataList.find((d) => d.equip_id === equipId);

    // ✅ equipId로부터 guksaId 추출
    if (!guksaId && equipId) {
      if (alarm) {
        guksaId = alarm.guksa_id || '';
        console.log(`equipId ${equipId}에 해당하는 국사ID 추출: ${guksaId}`);
      }
    }

    console.log(`선택된 옵션:`, selectedOption);
    console.log(`선택된 장비명: ${equipName}`);
    console.log(`선택된 장비ID: ${equipId}`);
    console.log(`선택된 국사ID: ${guksaId}`);

    console.log(
      `▶▶▶ handleEquipChangeEvent 분야: ${JSON.stringify(
        alarm
      )}, 장비명: ${equipName} 장비ID: ${equipId} 국사ID: ${guksaId}`
    );

    // 장비 변경 시 우측 채팅창 초기화
    if (_selectedView === 'equip') {
      handleEquipChangeEvent({
        equipName: equipName,
        equipId: equipId,
        equipSector: alarm?.sector || '확인 X',
        equipType: alarm?.equip_type || '확인 X',

        guksaName: alarm?.guksa_name || '확인 X',
        guksaId: guksaId,
      });
    }

    // API 호출하여 맵 그리기 - 장비 ID가 있으면 국사 ID가 없어도 API에서 처리 가능
    if (_selectedView === 'equip') {
      fetchEquipmentData({
        guksaId: guksaId,
        equipId: equipId,
        viewType: _selectedView,
      });
    } else {
      fetchEquipmentData({
        guksaId: guksaId,
        viewType: _selectedView,
      });
    }
  });
}

// 1. 국사 드롭다운 변경 이벤트 핸들러 추가
function guksaChangeEventHandler() {
  const guksaSelect = document.getElementById('searchGuksa');

  if (guksaSelect) {
    guksaSelect.addEventListener('change', function () {
      console.log('국사 선택 변경:', this.value);

      // 국사 변경 시 경보 데이터 다시 가져오기
      fetchAllAlarmsFromDB();

      // 분야별 장비 목록도 업데이트 (선택된 국사와 분야에 맞게)
      if (_selectedSector) {
        fetchSideBarEquipListBySector(_selectedSector);
      }
    });

    console.log('국사 선택 이벤트 리스너 추가 완료');
  } else {
    console.error('국사 선택 요소를 찾을 수 없습니다.');
  }
}

// 햄버거 버튼 이벤트 설정
function initHamburgerButton() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const leftSidebar = document.querySelector('.left-sidebar');

  if (!hamburgerBtn || !leftSidebar) {
    console.error('햄버거 버튼 또는 사이드바 요소를 찾을 수 없습니다.');
    return;
  }

  hamburgerBtn.addEventListener('click', function () {
    // 사이드바 토글
    leftSidebar.classList.toggle('hidden');

    // 햄버거 버튼 애니메이션
    hamburgerBtn.classList.toggle('active');

    console.log('사이드바 토글:', leftSidebar.classList.contains('hidden') ? '숨김' : '표시');
  });

  console.log('햄버거 버튼 이벤트 설정 완료');
}

// 초기화 함수
function initAll() {
  console.log('대시보드 초기화 시작');

  initDashboard();
  // initDragAndDrop();
  // setupTableHeaderSort();
  setupTableRowClick();
  setToggleViewButtons();
  initHamburgerButton();

  initSectorRadioEvent();

  equipChangeEventHandler();
  guksaChangeEventHandler();

  // 장애점 찾기 버튼 이벤트 초기화
  if (typeof initFaultPointButton === 'function') {
    setTimeout(() => {
      initFaultPointButton();
      console.log('장애점 찾기 버튼 이벤트 초기화 완료');
    }, 100);
  }

  // 맵 초기화 - 현재 뷰에 맞게 표시
  changeMapText(_selectedView);

  // 기본 장비 목록은 여전히 IP 분야로 초기화 (장비 선택 옵션을 위함)
  fetchSideBarEquipListBySector('IP');

  // 기본 검색 수행 - 모든 분야 데이터 가져오기
  console.log('기본 검색 수행 시작 - 모든 분야');
  fetchAllAlarmsFromDB();

  // 기본 선택된 IP 분야에 선택 스타일 적용
  setTimeout(() => {
    const ipDashboardBox = document.querySelector('.dashboard-box[data-sector="IP"]');
    if (ipDashboardBox) {
      ipDashboardBox.classList.add('selected');
      console.log('기본 IP 분야 선택 스타일 적용 완료');
    }
  }, 100);

  console.log('초기화 완료');
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('페이지 로드 완료, 테스트 시작');

  // 대시보드 클래스 강제 적용
  setDashboardLayout();

  // 맵 컨테이너 초기화
  clearMapContainer();

  // 사이드바 초기 상태 설정
  setSidebarState();

  // 국사 목록 로드
  fetchGuksaList();

  // 모든 초기화 함수 호출
  initAll();
});
