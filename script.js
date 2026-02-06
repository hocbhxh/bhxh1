// --- 1. CONFIG & INIT ---
        const ADMIN_USER = "admin"; // Tên đăng nhập
        const ADMIN_PASS = "123456"; // Mật khẩu
        const RATE = 0.22;
        
        let g_results = {};
        let g_optPrepaid = 60; 
        let g_optBackpay = 60; 
        let g_editingId = null;

        window.onload = function () {
            populateIncomeSelect();
            const config = JSON.parse(localStorage.getItem('bhxh_config_2025'));
            if(config && config.income) document.getElementById('incomeSelect').value = config.income;
            calculate();
            document.getElementById('printDate').innerText = new Date().toLocaleDateString('vi-VN');
            renderCRMList();
            
            // Enter key for login
            document.getElementById('loginPass').addEventListener("keypress", function(event) {
                if (event.key === "Enter") performLogin();
            });
        };

        function populateIncomeSelect() {
            const select = document.getElementById('incomeSelect');
            let html = '';
            for (let i = 1500000; i <= 46800000; i += 50000) { html += `<option value="${i}">${i.toLocaleString('vi-VN')} đ</option>`; }
            select.innerHTML = html;
        }

        // --- 2. LOGIC TÍNH TOÁN ---
        function calculate() {
            g_results = {}; 
            let income = parseInt(document.getElementById('incomeSelect').value) || 1500000;
            let interestRate = parseFloat(document.getElementById('interestRate').value) || 0.31;
            let inflation = parseFloat(document.getElementById('inflationRate').value) || 1.3;
            let statePercent = parseInt(document.getElementById('stateSupportSelect').value) || 0;
            let localPercent = parseInt(document.getElementById('localSupportSelect').value) || 0;

            localStorage.setItem('bhxh_config_2025', JSON.stringify({ income, interest: interestRate, inflation, state: statePercent, local: localPercent }));

            let incomeStr = income.toLocaleString('vi-VN') + ' đ';
            let supportStr = `Nhà nước ${statePercent}% + Địa phương ${localPercent}%`;
            document.getElementById('printIncome').innerText = incomeStr;
            document.getElementById('printSupport').innerText = supportStr;
            document.getElementById('printRate').innerText = interestRate + '%';
            document.getElementById('printCPI').innerText = inflation;
            document.getElementById('sumIncome').innerText = incomeStr;
            document.getElementById('sumSupport').innerText = supportStr;

            let monthlyFee = income * RATE;
            let monthlySupport = 1500000 * RATE * ((statePercent + localPercent) / 100);
            let actualMonthly = monthlyFee - monthlySupport;

            let pensionMale = (income * 0.40 * inflation).toLocaleString('vi-VN') + ' đ';
            let pensionFemale = (income * 0.45 * inflation).toLocaleString('vi-VN') + ' đ';
            document.getElementById('webPenMale').innerText = pensionMale;
            document.getElementById('webPenFemale').innerText = pensionFemale;
            document.getElementById('printPenMaleVal').innerText = pensionMale;
            document.getElementById('printPenFemaleVal').innerText = pensionFemale;

            let webHtml = '', printHtml = '';
            [1, 3, 6, 12].forEach(month => {
                let simplePay = Math.max(0, actualMonthly * month);
                let rawFee = monthlyFee * month;
                let sup = monthlySupport * month;
                g_results[month] = simplePay;
                webHtml += renderWebRow(`${month} Tháng`, '', rawFee, sup, 0, simplePay, false);
                printHtml += renderPrintRow(`${month} Tháng`, '', rawFee, sup, 0, simplePay);
            });

            let preMonth = g_optPrepaid;
            let preRaw = monthlyFee * preMonth;
            let preSup = monthlySupport * preMonth;
            let preFinal = calculatePV(monthlyFee, monthlySupport, preMonth, interestRate);
            let preDiff = preFinal - (actualMonthly * preMonth);
            g_results['prepaid'] = preFinal;
            
            let selectHtml = `
            <div class="method-wrapper">
                <div class="method-title">Đóng trước ⭐️</div>
                <select class="stylish-select" onchange="g_optPrepaid=parseInt(this.value);calculate()">
                    <option value="24" ${preMonth===24?'selected':''}>2 Năm</option>
                    <option value="36" ${preMonth===36?'selected':''}>3 Năm</option>
                    <option value="48" ${preMonth===48?'selected':''}>4 Năm</option>
                    <option value="60" ${preMonth===60?'selected':''}>5 Năm</option>
                </select>
            </div>`;
            webHtml += renderWebRow("", selectHtml, preRaw, preSup, preDiff, preFinal, true);
            printHtml += renderPrintRow(`${preMonth/12} Năm`, '(Đóng 1 lần)', preRaw, preSup, preDiff, preFinal);

            let backMonth = g_optBackpay;
            let backRaw = monthlyFee * backMonth;
            let backSup = monthlySupport * backMonth;
            let backFinal = calculateFV(monthlyFee, monthlySupport, backMonth, interestRate);
            let backDiff = backFinal - (actualMonthly * backMonth);
            g_results['backpay'] = backFinal;
            let inputHtml = `
            <div class="method-wrapper">
                <div class="method-title">Đóng 1 lần để nghỉ hưu</div>
                <div class="input-group-mini">
                    <input type="number" class="stylish-input" value="${backMonth}" max="60" min="1" onchange="updateBackpay(this.value)">
                    <span class="unit-text">tháng</span>
                </div>
            </div>`;
            webHtml += renderWebRow("", inputHtml, backRaw, backSup, backDiff, backFinal, false);
            printHtml += renderPrintRow(`${backMonth} Tháng`, '(Đóng bù nghỉ hưu)', backRaw, backSup, backDiff, backFinal);

            document.getElementById('webResultList').innerHTML = webHtml;
            document.getElementById('printResultTable').innerHTML = printHtml;
        }

        function calculatePV(fee, sup, months, rate) { let r = rate/100, pv=0; for(let i=0; i<months; i++) pv += fee/Math.pow(1+r, i); return Math.round(pv - (sup*months)); }
        function calculateFV(fee, sup, months, rate) { let r = rate/100, fv=0; for(let i=1; i<=months; i++) fv += fee*Math.pow(1+r, i); return Math.round(fv - (sup*months)); }
        
        // --- 3. UI HELPERS & AUTH ---
        function checkAuth() {
            if (sessionStorage.getItem('isLoggedIn') === 'true') {
                toggleCRM();
            } else {
                document.getElementById('loginOverlay').classList.add('active');
                document.getElementById('loginModal').classList.add('active');
                document.getElementById('loginUser').focus();
            }
        }

        function performLogin() {
            const u = document.getElementById('loginUser').value;
            const p = document.getElementById('loginPass').value;
            if (u === ADMIN_USER && p === ADMIN_PASS) {
                sessionStorage.setItem('isLoggedIn', 'true');
                document.getElementById('loginOverlay').classList.remove('active');
                document.getElementById('loginModal').classList.remove('active');
                toggleCRM();
            } else {
                alert("Sai tên đăng nhập hoặc mật khẩu!");
            }
        }

        function logout() {
            sessionStorage.removeItem('isLoggedIn');
            toggleCRM(); // Đóng menu
            alert("Đã đăng xuất!");
        }

        // --- 4. AUTO FILL LOGIC ---
        function checkAutoFillBHXH() {
            let code = document.getElementById('custBhxh').value.trim();
            if (!code) return;
            let list = JSON.parse(localStorage.getItem('bhxh_crm_list')) || [];
            let found = list.find(x => x.bhxhCode == code);
            if (found) {
                document.getElementById('custName').value = found.name || '';
                document.getElementById('custDob').value = found.dob || '';
                document.getElementById('custGender').value = found.gender || 'Nam';
                document.getElementById('custCccd').value = found.cccd || '';
                document.getElementById('custNation').value = found.nation || 'Kinh';
                document.getElementById('custPhone').value = found.phone || '';
                document.getElementById('custAddr').value = found.address || '';
                if(found.income) document.getElementById('incomeSelect').value = found.income;
                if(found.note) document.getElementById('custNote').value = found.note;
                calculate();
                alert('Đã tìm thấy thông tin cũ. Tự động điền!');
            }
        }

        // --- 5. CRM CORE FUNCTIONS ---
        function toggleCRM() { 
            document.getElementById('crmSidebar').classList.toggle('active'); 
            document.getElementById('crmOverlay').classList.toggle('active');
            hideAddCustomerForm(); 
        }

        function toggleFaq(btn) {
            btn.parentElement.classList.toggle('active');
            let content = btn.nextElementSibling;
            if (content.style.maxHeight) content.style.maxHeight = null;
            else content.style.maxHeight = content.scrollHeight + "px";
        }

        function autoCalculateToMonth() {
            let fromVal = document.getElementById('custFrom').value;
            let method = parseInt(document.getElementById('custMethod').value) || 12;
            if (fromVal) {
                let [year, month] = fromVal.split('-').map(Number);
                let date = new Date(year, month - 1, 1);
                date.setMonth(date.getMonth() + method - 1);
                let toVal = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                document.getElementById('custTo').value = toVal;
            }
        }

        function showAddCustomerForm(id = null) {
            g_editingId = id;
            document.getElementById('crmListMode').style.display = 'none';
            document.getElementById('crmFormMode').style.display = 'block';
            document.querySelectorAll('.crm-input').forEach(el => el.value = '');
            document.getElementById('custNation').value = 'Kinh';
            document.getElementById('custGender').value = 'Nam';
            document.getElementById('custMethod').value = '12'; 
            
            if (id) {
                document.getElementById('crmHeaderTitle').innerText = "Sửa hồ sơ";
                document.getElementById('btnSaveCrm').innerText = "Cập nhật";
                let list = JSON.parse(localStorage.getItem('bhxh_crm_list')) || [];
                let p = list.find(x => x.id == id);
                if(p) {
                    document.getElementById('custName').value = p.name;
                    document.getElementById('custBhxh').value = p.bhxhCode;
                    document.getElementById('custDob').value = p.dob || '';
                    document.getElementById('custMethod').value = p.method || '12';
                    document.getElementById('custFrom').value = p.fromMonth || '';
                    document.getElementById('custTo').value = p.toMonth || '';
                    document.getElementById('custAmount').value = p.paidAmount || '';
                    document.getElementById('custNote').value = p.note || ''; 
                    document.getElementById('custGender').value = p.gender;
                    document.getElementById('custCccd').value = p.cccd;
                    document.getElementById('custPhone').value = p.phone;
                    document.getElementById('custNation').value = p.nation;
                    document.getElementById('custAddr').value = p.address;
                }
            } else {
                document.getElementById('crmHeaderTitle').innerText = "Thêm hồ sơ mới";
                document.getElementById('btnSaveCrm').innerText = "Lưu hồ sơ";
            }
        }

        function hideAddCustomerForm() {
            g_editingId = null;
            document.getElementById('crmListMode').style.display = 'block';
            document.getElementById('crmFormMode').style.display = 'none';
            document.getElementById('crmHeaderTitle').innerText = "Danh sách khách hàng";
        }

        function saveCustomerProfile() {
            let name = document.getElementById('custName').value;
            if (!name) { alert("Vui lòng nhập họ tên!"); return; }

            let profileData = {
                id: g_editingId ? g_editingId : Date.now(),
                name: name,
                bhxhCode: document.getElementById('custBhxh').value,
                dob: document.getElementById('custDob').value,
                method: document.getElementById('custMethod').value,
                fromMonth: document.getElementById('custFrom').value,
                toMonth: document.getElementById('custTo').value,
                paidAmount: document.getElementById('custAmount').value,
                note: document.getElementById('custNote').value, 
                gender: document.getElementById('custGender').value,
                cccd: document.getElementById('custCccd').value,
                phone: document.getElementById('custPhone').value,
                nation: document.getElementById('custNation').value,
                address: document.getElementById('custAddr').value,
                date: new Date().toLocaleDateString('vi-VN'),
                income: document.getElementById('incomeSelect').value,
                state: document.getElementById('stateSupportSelect').value,
                local: document.getElementById('localSupportSelect').value
            };

            let list = JSON.parse(localStorage.getItem('bhxh_crm_list')) || [];
            if (g_editingId) {
                let index = list.findIndex(x => x.id == g_editingId);
                if (index !== -1) list[index] = profileData;
            } else {
                list.unshift(profileData);
            }
            localStorage.setItem('bhxh_crm_list', JSON.stringify(list));
            
            const btn = document.getElementById('btnSaveCrm');
            const originalText = btn.innerText;
            const isUpdate = !!g_editingId;
            btn.innerHTML = `<i class="fa-solid fa-check"></i> ${isUpdate ? 'Đã cập nhật!' : 'Đã lưu!'}`;
            btn.style.background = "#27ae60";

            setTimeout(() => {
                hideAddCustomerForm();
                renderCRMList();
                btn.innerHTML = originalText;
                btn.style.background = ""; 
            }, 2000);
        }

        function deleteProfile(id, e) {
            e.stopPropagation();
            if(confirm("Bạn chắc chắn muốn xóa hồ sơ này?")) {
                let list = JSON.parse(localStorage.getItem('bhxh_crm_list')) || [];
                list = list.filter(x => x.id != id);
                localStorage.setItem('bhxh_crm_list', JSON.stringify(list));
                renderCRMList();
            }
        }
        
        function editProfile(id, e) { e.stopPropagation(); showAddCustomerForm(id); }

        function viewProfileDetails(id, e) {
            e.stopPropagation();
            let list = JSON.parse(localStorage.getItem('bhxh_crm_list')) || [];
            let p = list.find(x => x.id == id);
            if(!p) return;

            let methodText = p.method ? `${p.method} tháng` : '---';
            let dateRange = (p.fromMonth && p.toMonth) ? `${p.fromMonth} <i class="fa-solid fa-arrow-right"></i> ${p.toMonth}` : '---';
            let dobDisplay = p.dob ? p.dob.split('-').reverse().join('/') : '---';
            
            let html = `
                <div style="text-align:center; margin-bottom:15px">
                    <div style="font-size:1.2rem; font-weight:800; color:#4318ff">${p.name}</div>
                    <div style="font-size:0.9rem; color:#666">${p.bhxhCode || 'Chưa có mã số'}</div>
                </div>
                <table class="profile-table">
                    <tr><td>Ngày sinh</td><td>${dobDisplay}</td></tr>
                    <tr><td>Giới tính</td><td>${p.gender}</td></tr>
                    <tr><td>CCCD/CMND</td><td>${p.cccd || '---'}</td></tr>
                    <tr><td>Số điện thoại</td><td>${p.phone || '---'}</td></tr>
                    <tr><td>Dân tộc</td><td>${p.nation || '---'}</td></tr>
                    <tr><td>Địa chỉ</td><td>${p.address || '---'}</td></tr>
                    <tr><td colspan="2"><hr style="border:0; border-top:1px dashed #eee; margin:10px 0"></td></tr>
                    <tr><td>Phương thức đóng</td><td>${methodText}</td></tr>
                    <tr><td>Giai đoạn</td><td>${dateRange}</td></tr>
                    <tr><td>Số tiền đóng</td><td style="color:#e74c3c; font-size:1.1rem">${p.paidAmount ? p.paidAmount + ' đ' : '---'}</td></tr>
                    <tr><td>Ghi chú</td><td>${p.note || '---'}</td></tr>
                </table>
            `;
            document.getElementById('profileModalBody').innerHTML = html;
            document.getElementById('modalOverlay').classList.add('active'); 
            document.getElementById('profileModal').classList.add('active');
        }

        function closeAllModals() {
            document.querySelectorAll('.modal-box').forEach(el => el.classList.remove('active'));
            document.getElementById('modalOverlay').classList.remove('active');
            document.getElementById('loginOverlay').classList.remove('active');
        }

        function loadProfile(id) {
            let list = JSON.parse(localStorage.getItem('bhxh_crm_list')) || [];
            let p = list.find(x => x.id == id);
            if(p) {
                document.getElementById('incomeSelect').value = p.income;
                document.getElementById('stateSupportSelect').value = p.state;
                document.getElementById('localSupportSelect').value = p.local;
                calculate();
                toggleCRM(); 
            }
        }

        function toggleSearchBox() {
            let title = document.getElementById('listTitle');
            let box = document.getElementById('searchBox');
            let btn = document.getElementById('btnSearchToggle');
            let input = document.getElementById('searchInput');

            if(box.style.display === 'none') {
                title.style.display = 'none';
                box.style.display = 'block';
                btn.innerHTML = '<i class="fa-solid fa-times"></i>';
                input.focus();
            } else {
                title.style.display = 'block';
                box.style.display = 'none';
                btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
                input.value = '';
                filterCRMList(); 
            }
        }

        function filterCRMList() {
            let keyword = document.getElementById('searchInput').value.toLowerCase();
            let list = JSON.parse(localStorage.getItem('bhxh_crm_list')) || [];
            let filtered = list.filter(p => 
                (p.name && p.name.toLowerCase().includes(keyword)) ||
                (p.bhxhCode && p.bhxhCode.includes(keyword)) ||
                (p.phone && p.phone.includes(keyword))
            );
            renderCRMList(filtered);
        }

        function renderCRMList(data = null) {
            let list = data || JSON.parse(localStorage.getItem('bhxh_crm_list')) || [];
            let html = '';
            if(list.length === 0) {
                html = '<div style="text-align:center;color:#999;margin-top:20px">Không tìm thấy hồ sơ nào</div>';
            } else {
                list.forEach(p => {
                    let income = parseInt(p.income).toLocaleString('vi-VN');
                    html += `
                    <div class="crm-item" onclick="loadProfile(${p.id})">
                        <div class="crm-name">${p.name}</div>
                        <div class="crm-sub"><i class="fa-regular fa-id-card"></i> ${p.cccd || '---'}</div>
                        <div class="crm-tag">${income} đ</div>
                        <div class="item-actions">
                            <button class="btn-icon-crm btn-view-crm" onclick="viewProfileDetails(${p.id}, event)" title="Xem chi tiết"><i class="fa-solid fa-eye"></i></button>
                            <button class="btn-icon-crm btn-edit-crm" onclick="editProfile(${p.id}, event)" title="Sửa"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button class="btn-icon-crm btn-del-crm" onclick="deleteProfile(${p.id}, event)" title="Xóa"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>`;
                });
            }
            document.getElementById('crmListContainer').innerHTML = html;
        }

        function toggleSettings() { document.getElementById('settingsBox').classList.toggle('active'); }
        function updateBackpay(v) { v = parseInt(v); if(v>60){alert("Tối đa 60 tháng");v=60;} g_optBackpay = v; calculate(); }
        function formatMoney(n) { return Math.round(n).toLocaleString('vi-VN') + ' đ'; }
        
        function renderWebRow(lbl, sub, raw, sup, diff, final, hl) {
            let df = diff < 0 ? `<span style="color:#f39c12">${formatMoney(diff)}</span>` : (diff>0 ? `<span style="color:#e74c3c">+${formatMoney(diff)}</span>` : '-');
            let labelHtml = sub ? sub : `<div class="res-label">${lbl}</div>`;
            if(!sub) labelHtml = `<div class="res-label">${lbl}</div>`;
            return `
            <div class="result-item ${hl?'item-hl':''}">
                ${labelHtml}
                <div class="res-col res-val" data-label="Tổng đóng">${formatMoney(raw)}</div>
                <div class="res-col res-val" data-label="Hỗ trợ" style="color:#27ae60">-${formatMoney(sup)}</div>
                <div class="res-col res-val" data-label="Lãi/Giảm">${df}</div>
                <div class="res-col"><div class="res-final">${formatMoney(final)}</div></div>
            </div>`;
        }
        function renderPrintRow(lbl, note, raw, sup, diff, final) {
            return `<tr><td>${lbl}<br><i>${note}</i></td><td>${formatMoney(raw)}</td><td>-${formatMoney(sup)}</td><td>${diff!=0?formatMoney(diff):''}</td><td>${formatMoney(final)}</td></tr>`;
        }

        function copyToZalo() {
            let incomeVal = parseInt(document.getElementById('incomeSelect').value);
            let interestRate = parseFloat(document.getElementById('interestRate').value) || 0.31;
            let statePercent = parseInt(document.getElementById('stateSupportSelect').value) || 0;
            let localPercent = parseInt(document.getElementById('localSupportSelect').value) || 0;
            const RATE = 0.22;

            let monthlyFee = incomeVal * RATE;
            let monthlySupport = 1500000 * RATE * ((statePercent + localPercent) / 100);
            let actualMonthly = monthlyFee - monthlySupport;

            let pay1 = Math.max(0, actualMonthly * 1);
            let pay3 = Math.max(0, actualMonthly * 3);
            let pay6 = Math.max(0, actualMonthly * 6);
            let pay12 = Math.max(0, actualMonthly * 12);
            let pay60 = calculatePV(monthlyFee, monthlySupport, 60, interestRate);

            let content = `*BẢNG DỰ TÍNH BHXH TỰ NGUYỆN*\n`;
            content += `------------------------\n`;
            content += `💰 Mức thu nhập: ${formatMoney(incomeVal)}\n\n`;
            content += `*SỐ TIỀN THỰC ĐÓNG:*\n`;
            content += `⭐️ Đóng 1 tháng: ${formatMoney(pay1)}\n`;
            content += `⭐️ Đóng 3 tháng: ${formatMoney(pay3)}\n`;
            content += `⭐️ Đóng 6 tháng: ${formatMoney(pay6)}\n`;
            content += `⭐️ Đóng 12 tháng: ${formatMoney(pay12)}\n`;
            content += `⭐️ Đóng 5 Năm: ${formatMoney(pay60)} (Tiết kiệm nhất)\n`;
            content += `------------------------\n`;
            content += `(Số liệu tham khảo theo quy định hiện hành)`;

            navigator.clipboard.writeText(content).then(() => { 
                const btn = document.getElementById('btnCopy');
                const originalHtml = btn.innerHTML;
                const originalBg = btn.style.background;
                btn.innerHTML = `<i class="fa-solid fa-check"></i> Đã copy!`;
                btn.style.background = "#27ae60";
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.style.background = originalBg;
                }, 2000);
            });
        }
        function exportImage() {
            document.getElementById('captureSummary').style.display='block';
            html2canvas(document.getElementById("captureCard"), {scale:2, backgroundColor:"#f4f7fe"}).then(c => {
                let l = document.createElement('a'); l.download=`BHXH-${Date.now()}.png`; l.href=c.toDataURL(); l.click();
                document.getElementById('captureSummary').style.display='none';
            });
        }
        
        function exportToExcel() {
            let data = JSON.parse(localStorage.getItem('bhxh_crm_list')) || [];
            if(data.length === 0) { alert("Chưa có dữ liệu!"); return; }
            let fromDateVal = document.getElementById('filterFrom').value;
            let toDateVal = document.getElementById('filterTo').value;

            if (fromDateVal || toDateVal) {
                let from = fromDateVal ? new Date(fromDateVal) : new Date('1900-01-01');
                let to = toDateVal ? new Date(toDateVal) : new Date('2100-01-01');
                to.setHours(23, 59, 59, 999);
                data = data.filter(item => {
                    if (!item.date) return false;
                    let parts = item.date.split('/');
                    let itemDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    return itemDate >= from && itemDate <= to;
                });
                if (data.length === 0) { alert("Không có hồ sơ nào trong khoảng thời gian đã chọn!"); return; }
            }

            let formattedData = data.map(item => ({ 
                "MaBHXH": item.bhxhCode, "Hovaten": item.name, "Ngaysinh": item.dob, "Gioitinh": item.gender, "CCCD": item.cccd, 
                "SDT": item.phone, "Dantoc": item.nation, "Diachi": item.address, "Phuongthucdong": item.method, 
                "Tuthang": item.fromMonth, "Denthang": item.toMonth, "Mucthunhap": item.income, "Sotiendong": item.paidAmount, "Ghichu": item.note 
            }));
            let wb = XLSX.utils.book_new();
            let ws = XLSX.utils.json_to_sheet(formattedData);
            XLSX.utils.book_append_sheet(wb, ws, "KhachHang");
            let fileName = `Danh_Sach_BHXH_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
            XLSX.writeFile(wb, fileName);
        }
        
        function importFromExcel(input) {
            let file = input.files[0];
            if(!file) return;
            let reader = new FileReader();
            reader.onload = function(e) {
                let data = new Uint8Array(e.target.result);
                let workbook = XLSX.read(data, {type: 'array'});
                let sheetName = workbook.SheetNames[0];
                let jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                if(jsonData.length > 0) {
                    let currentList = JSON.parse(localStorage.getItem('bhxh_crm_list')) || [];
                    let newList = jsonData.map(row => ({
                        id: Date.now() + Math.random(), 
                        name: row['Hovaten'] || '', bhxhCode: row['MaBHXH'] || '', phone: row['SDT'] || '',
                        dob: row['Ngaysinh'] || '', cccd: row['CCCD'] || '', address: row['Diachi'] || '',
                        paidAmount: row['Sotiendong'] || '', income: row['Mucthunhap'] || '1500000', 
                        method: row['Phuongthucdong'] || '12', fromMonth: row['Tuthang'] || '',
                        toMonth: row['Denthang'] || '', gender: row['Gioitinh'] || 'Nam', 
                        nation: row['Dantoc'] || 'Kinh', note: row['Ghichu'] || ''
                    }));
                    let mergedList = [...newList, ...currentList];
                    localStorage.setItem('bhxh_crm_list', JSON.stringify(mergedList));
                    renderCRMList();
                    alert(`Đã nhập thành công ${newList.length} khách hàng!`);
                }
            };
            reader.readAsArrayBuffer(file);
        }