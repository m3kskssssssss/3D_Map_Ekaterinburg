class Map3D {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.buildings = [];
        this.routes = [];
        this.labels = [];
        this.currentRoute = 'historical';
        this.buildingsData = null;
        this.animationId = null;
        this.buildingsVisible = true;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredBuilding = null;
        this.labelDiv = null;
        
        // Размеры оригинальной карты в пикселях
        this.mapPixelWidth = 3248;
        this.mapPixelHeight = 4096;
        
        // Размеры карты в Three.js
        this.mapWidth = 400;  // ширина в единицах Three.js
        this.mapHeight = 504; // высота в единицах Three.js
        
        this.init();
    }

    async init() {
        await this.loadBuildingsData();
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupControls();
        this.setupLighting();
        this.createGround();
        this.createLabelDiv();
        this.setupEventListeners();
        this.loadRoute(this.currentRoute);
        this.animate();
        this.hideLoading();
    }

    async loadBuildingsData() {
        try {
            console.log('Загружаем данные о зданиях...');
            const response = await fetch('buildings.json');
            if (response.ok) {
                this.buildingsData = await response.json();
                console.log('Данные загружены:', this.buildingsData);
            } else {
                throw new Error('Не удалось загрузить buildings.json');
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            alert('Ошибка загрузки данных о зданиях. Убедитесь, что buildings.json находится в той же папке.');
        }
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            10000
        );
        this.camera.position.set(0, 100, 150);
        this.camera.lookAt(0, 0, 0);
    }

    setupRenderer() {
        const container = document.getElementById('map3d');
        if (!container) {
            console.error('Контейнер #map3d не найден в DOM!');
            return;
        }
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);
        
        console.log('Renderer создан успешно');
    }

    setupControls() {
        if (!this.renderer || !this.renderer.domElement) {
            console.error('Невозможно создать контролы: renderer не инициализирован');
            return;
        }
        
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 30;
        this.controls.maxDistance = 5000000000;
        this.controls.maxPolarAngle = Math.PI / 2.2;
        this.controls.target.set(0, 0, 0);
        
        console.log('Контролы созданы успешно');
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
        mainLight.position.set(100, 150, 50);
        this.scene.add(mainLight);
        
        const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
        topLight.position.set(0, 200, 0);
        this.scene.add(topLight);
    }

    createGround() {
        // Создаем плоскость с правильным соотношением сторон 3248:4096
        const geometry = new THREE.PlaneGeometry(
            this.mapWidth * 2,  // ширина
            this.mapHeight * 2, // высота (выше, чем шире)
            1, 
            1
        );
        
        // Загружаем текстуру карты
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load('ekb.png', () => {
            console.log('Текстура карты загружена с пропорциями 3248x4096');
        }, undefined, (error) => {
            console.error('Ошибка загрузки текстуры:', error);
        });
        
        const material = new THREE.MeshBasicMaterial({ 
            map: texture,
            side: THREE.DoubleSide
        });
        
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        this.scene.add(ground);
        
        console.log(`Карта создана: ширина=${this.mapWidth * 2}, высота=${this.mapHeight * 2}`);
    }

    pixelsToThree(pixelX, pixelY) {
        // Конвертируем пиксели карты (от левого верхнего угла) в координаты Three.js
        // Центр карты в пикселях: (1624, 2048)
        // Центр карты в Three.js: (0, 0)
        
        const centerX = this.mapPixelWidth / 2;   // 1624
        const centerY = this.mapPixelHeight / 2;  // 2048
        
        const scaleX = (this.mapWidth * 2) / this.mapPixelWidth;   // 800/3248
        const scaleZ = (this.mapHeight * 2) / this.mapPixelHeight; // 1008/4096
        
        const x = (pixelX - centerX) * scaleX;
        const z = (pixelY - centerY) * scaleZ;
        
        return { x, z };
    }

    createBuilding(buildingData) {
        console.log(`Создаем: ${buildingData.name}`);
        
        const buildingGroup = new THREE.Group();
        
        // Используем размеры напрямую из buildingData (они теперь в единицах Three.js)
        const geometry = new THREE.BoxGeometry(
            buildingData.width,
            buildingData.height,
            buildingData.depth
        );
        
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.3,
            roughness: 0.3,
            metalness: 0.6,
            transparent: false,
            opacity: 1.0
        });
        
        const building = new THREE.Mesh(geometry, material);
        building.castShadow = false;
        building.receiveShadow = false;
        
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000, 
            linewidth: 3
        });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        building.add(wireframe);
        
        buildingGroup.add(building);
        
        // Используем пиксельные координаты
        const coords = this.pixelsToThree(buildingData.pixelX, buildingData.pixelY);
        buildingGroup.position.set(
            coords.x,
            buildingData.height / 2,
            coords.z
        );
        
        // Явно обнуляем вращение
        buildingGroup.rotation.set(0, 0, 0);
        
        buildingGroup.userData = {
            ...buildingData,
            originalColor: 0xffffff,
            originalEmissive: 0xffffff
        };
        
        // Создаем кликабельную метку над зданием
        this.createClickableLabel(buildingData, coords.x, buildingData.height, coords.z);
        
        return buildingGroup;
    }

    createClickableLabel(buildingData, x, y, z) {
        // Создаем HTML элемент для кликабельной метки
        const labelDiv = document.createElement('div');
        labelDiv.className = 'building-label';
        labelDiv.textContent = buildingData.name;
        labelDiv.style.position = 'fixed';
        labelDiv.style.color = '#fff';
        labelDiv.style.background = 'rgba(0, 0, 0, 0.8)';
        labelDiv.style.padding = '5px 10px';
        labelDiv.style.borderRadius = '5px';
        labelDiv.style.fontSize = '12px';
        labelDiv.style.cursor = 'pointer';
        labelDiv.style.zIndex = '1000';
        labelDiv.style.pointerEvents = 'auto';
        labelDiv.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        labelDiv.style.transition = 'all 0.2s ease';
        labelDiv.style.whiteSpace = 'nowrap';
        
        // Обработчик клика - открывает Яндекс.Карты
        labelDiv.addEventListener('click', () => {
            const query = encodeURIComponent(buildingData.name + ' ' + buildingData.address);
            window.open(`https://yandex.ru/maps/?text=${query}`, '_blank');
        });
        
        labelDiv.addEventListener('mouseenter', () => {
            labelDiv.style.background = 'rgba(255, 255, 255, 0.9)';
            labelDiv.style.color = '#000';
        });
        
        labelDiv.addEventListener('mouseleave', () => {
            labelDiv.style.background = 'rgba(0, 0, 0, 0.8)';
            labelDiv.style.color = '#fff';
        });
        
        document.body.appendChild(labelDiv);
        this.labels.push({ div: labelDiv, position: new THREE.Vector3(x, y + 5, z) });
    }

    updateLabelsPosition() {
        // Обновляем позиции меток относительно камеры
        this.labels.forEach(label => {
            const screenPos = label.position.clone();
            screenPos.project(this.camera);
            
            const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (screenPos.y * -0.5 + 0.5) * window.innerHeight;
            
            label.div.style.left = x + 'px';
            label.div.style.top = y + 'px';
            
            // Скрываем метки за камерой
            if (screenPos.z > 1) {
                label.div.style.display = 'none';
            } else {
                label.div.style.display = 'block';
            }
        });
    }

    createRoutePath(buildings) {
        this.routes.forEach(route => this.scene.remove(route));
        this.routes = [];
        
        if (buildings.length < 2) return;
        
        const points = [];
        buildings.forEach(buildingData => {
            const coords = this.pixelsToThree(buildingData.pixelX, buildingData.pixelY);
            points.push(new THREE.Vector3(coords.x, 2, coords.z));
        });
        
        const curve = new THREE.CatmullRomCurve3(points);
        const pathPoints = curve.getPoints(100);
        const geometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
        
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 3,
            transparent: true,
            opacity: 0.8
        });
        
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        this.routes.push(line);
        
    }

    createNumberSprite(number) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(number.toString(), 64, 70);
        
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(12, 12, 1);
        
        return sprite;
    }

    createLabelDiv() {
        this.labelDiv = document.createElement('div');
        this.labelDiv.style.position = 'fixed';
        this.labelDiv.style.background = 'rgba(255, 255, 255, 0.98)';
        this.labelDiv.style.color = '#000';
        this.labelDiv.style.padding = '15px 20px';
        this.labelDiv.style.border = '2px solid #000';
        this.labelDiv.style.pointerEvents = 'none';
        this.labelDiv.style.display = 'none';
        this.labelDiv.style.zIndex = '10000';
        this.labelDiv.style.fontSize = '18px';
        this.labelDiv.style.fontWeight = 'bold';
        this.labelDiv.style.maxWidth = '300px';
        this.labelDiv.style.textAlign = 'center';
        this.labelDiv.style.textTransform = 'uppercase';
        this.labelDiv.style.letterSpacing = '1px';
        this.labelDiv.style.borderRadius = '8px';
        document.body.appendChild(this.labelDiv);
    }

    loadRoute(routeName) {
        this.clearBuildings();
        
        if (!this.buildingsData || !this.buildingsData[routeName]) {
            console.error(`Маршрут ${routeName} не найден`);
            return;
        }

        const routeData = this.buildingsData[routeName];
        console.log(`Загружаем: ${routeData.name}`);

        routeData.buildings.forEach((buildingData, index) => {
            setTimeout(() => {
                const building = this.createBuilding(buildingData);
                this.scene.add(building);
                this.buildings.push(building);
                this.animateBuildingAppearance(building);
            }, index * 150);
        });
        
        setTimeout(() => {
            this.createRoutePath(routeData.buildings);
        }, routeData.buildings.length * 150 + 500);
    }

    animateBuildingAppearance(building) {
        const originalY = building.position.y;
        building.position.y = -50;
        building.scale.set(0.1, 0.1, 0.1);
        
        const startTime = Date.now();
        const duration = 1000;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOutBounce = (t) => {
                if (t < 1 / 2.75) {
                    return 7.5625 * t * t;
                } else if (t < 2 / 2.75) {
                    return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
                } else if (t < 2.5 / 2.75) {
                    return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
                } else {
                    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
                }
            };
            
            const easedProgress = easeOutBounce(progress);
            building.position.y = -50 + (originalY + 50) * easedProgress;
            building.scale.setScalar(0.1 + 0.9 * easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    clearBuildings() {
        this.buildings.forEach(building => this.scene.remove(building));
        this.buildings = [];
        this.routes.forEach(route => this.scene.remove(route));
        this.routes = [];
        
        // Удаляем кликабельные метки
        this.labels.forEach(label => {
            if (label.div && label.div.parentNode) {
                label.div.parentNode.removeChild(label.div);
            }
        });
        this.labels = [];
    }

    setupEventListeners() {
        // Переключение маршрутов
        document.querySelectorAll('.route-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const route = e.target.dataset.route;
                this.switchRoute(route);
            });
        });

        // Обработка мыши для интерактивности
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.addEventListener('mousemove', (event) => {
                this.onMouseMove(event);
            });
        } else {
            console.error('Renderer domElement не найден!');
        }

        // Обработка изменения размера окна
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
    }

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.buildings, true);

        if (this.hoveredBuilding) {
            this.hoveredBuilding.children[0].material.emissiveIntensity = 0.3;
        }

        if (intersects.length > 0) {
            let parent = intersects[0].object;
            while (parent.parent && !parent.userData.name) {
                parent = parent.parent;
            }

            if (parent.userData && parent.userData.name) {
                this.hoveredBuilding = parent;
                parent.children[0].material.emissiveIntensity = 0.8;
                
                document.body.style.cursor = 'pointer';
            }
        } else {
            this.labelDiv.style.display = 'none';
            this.hoveredBuilding = null;
            document.body.style.cursor = 'default';
        }
    }

    switchRoute(routeName) {
        console.log(`Переключение на: ${routeName}`);
        
        document.querySelectorAll('.route-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-route="${routeName}"]`).classList.add('active');
        
        this.currentRoute = routeName;
        this.loadRoute(routeName);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update();
        }
        
        // Обновляем позиции кликабельных меток
        this.updateLabelsPosition();
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.labelDiv) {
            document.body.removeChild(this.labelDiv);
        }
        this.renderer.dispose();
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.map3d = new Map3D();
});