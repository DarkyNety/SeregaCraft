// js/menu.js
export function initMenu(startGameCallback) {
    const overlay = document.getElementById('overlay');
    const mainMenu = document.getElementById('main-menu');
    const worldSelect = document.getElementById('world-select');
    const settingsPanel = document.getElementById('settings-panel');

    // Прячем все панели, кроме главного меню
    function showOnlyMain() {
        mainMenu.style.display = 'block';
        worldSelect.style.display = 'none';
        settingsPanel.style.display = 'none';
    }

    // Обработчики главного меню
    document.getElementById('btn-singleplayer').addEventListener('click', () => {
        // Показать выбор мира
        mainMenu.style.display = 'none';
        worldSelect.style.display = 'block';
        populateWorldList(); // отобразить сохранённые миры
    });

    document.getElementById('btn-multiplayer').addEventListener('click', () => {
        alert('Мультиплеер пока в разработке');
    });

    document.getElementById('btn-settings').addEventListener('click', () => {
        mainMenu.style.display = 'none';
        settingsPanel.style.display = 'block';
    });

    document.getElementById('btn-donate').addEventListener('click', () => {
        window.open('https://www.donationalerts.com/r/your_page', '_blank');
    });

    document.getElementById('btn-skin').addEventListener('click', () => {
        // Выходим из меню и сразу запускаем игру, потом открываем выбор скина?
        // Лучше сделать так: сначала игра стартует, потом внутри игры кнопка "Скин" уже есть.
        // Просто запускаем игру.
        startGameCallback();
    });

    // Назад из выбора мира
    document.getElementById('btn-back-to-menu').addEventListener('click', showOnlyMain);
    document.getElementById('btn-settings-back').addEventListener('click', showOnlyMain);

    // Кнопка "Новый мир"
    document.getElementById('btn-new-world').addEventListener('click', () => {
        const worldName = prompt('Название нового мира:', 'Мир ' + new Date().toLocaleDateString());
        if (worldName !== null) {
            const seed = Math.floor(Math.random() * 2147483647); // случайный seed
            startGameCallback(null, worldName, seed);
        }
    });

    // Кнопка "Загрузить мир из файла"
    document.getElementById('btn-load-world').addEventListener('click', () => {
        document.getElementById('load-file-input').click(); // используем существующий input
    });

    // Когда игра загружена из файла, событие change обрабатывается в main.js,
    // но сейчас мы можем упростить: после загрузки файла скроем меню и запустим игру.
    document.getElementById('load-file-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                const worldData = ev.target.result;
                startGameCallback(worldData, null); // worldData – JSON для loadFromJSON
            } catch (err) {
                alert('Ошибка загрузки файла');
            }
        };
        reader.readAsText(file);
        this.value = ''; // сброс input
    });

    // Список сохранённых миров из localStorage
    function populateWorldList() {
        const list = document.getElementById('world-list');
        list.innerHTML = '';
        const worlds = JSON.parse(localStorage.getItem('seregacraft_worlds') || '[]');
        if (worlds.length === 0) {
            list.innerHTML = '<li>Нет сохранённых миров</li>';
        } else {
            worlds.forEach(name => {
                const li = document.createElement('li');
                li.textContent = name;
                li.addEventListener('click', () => {
                    // Загружаем данные из localStorage по ключу 'world_' + name
                    const data = localStorage.getItem('world_' + name);
                    if (data) {
                        startGameCallback(data, name);
                    } else {
                        alert('Мир не найден');
                    }
                });
                list.appendChild(li);
            });
        }
    }

    // Изначально показываем главное меню
    overlay.style.display = 'flex'; // делаем меню видимым
    showOnlyMain();
}