const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const createError = require('http-errors');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const nunjucks = require('nunjucks');
const cors = require('cors');

const indexRouter = require('./routes/index');
// const usersRouter = require('./routes/users');

const app = express();
const port = process.env.PORT || 3000;

// Sequelize 연결 설정
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite'
});

const corsOptions = {
  origin: 'https://peaceful-klepon-eaac7b.netlify.app', // 프론트엔드 주소
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Express 앱 설정
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'njk');
nunjucks.configure('views', { 
  express: app,
  watch: true,
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors(corsOptions));

// 예약 정보를 담을 빈 배열 또는 초기화
let reservations = [];

// Reservation 모델 정의
const Reservation = sequelize.define('Reservation', {
    hotelId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    reserveStartDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    reserveEndDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    reserveGuests: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    reserveName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    userName: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    timestamps: true
});

// User 모델 정의
const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

// 예약 테이블 생성
async function syncReservationDatabase() {
    try {
        await sequelize.authenticate();
        await Reservation.sync({ force: true }); // force: true로 설정하면 테이블을 강제로 재생성합니다.
        console.log('예약 테이블이 성공적으로 생성되었습니다.');
    } catch (error) {
        console.error('SQLite 연결 실패:', error);
    }
}

// 사용자 테이블 생성
async function syncUserDatabase() {
    try {
        await sequelize.authenticate();
        await User.sync({ force: true }); // force: true로 설정하면 테이블을 강제로 재생성합니다.
        console.log('사용자 테이블이 성공적으로 생성되었습니다.');
    } catch (error) {
        console.error('SQLite 연결 실패:', error);
    }
}

// 라우트 설정
app.use('/', indexRouter);
// app.use('/users', usersRouter);

// 회원가입 API
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.create({
            username: username,
            password: password
        });

        res.status(201).json({ message: '회원가입이 완료되었습니다.', user });
    } catch (error) {
        console.error('회원가입 중 오류 발생:', error);
        res.status(500).json({ error: '회원가입 중 오류 발생' });
    }
});

// 로그인 API
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ where: { username: username } });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        if (user.password !== password) {
            return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
        }

        res.status(200).json({ message: '로그인 성공', user });
    } catch (error) {
        console.error('로그인 중 오류 발생:', error);
        res.status(500).json({ error: '로그인 중 오류 발생' });
    }
});

// 예약 API
app.post('/reserve', async (req, res) => {
    const { hotelId, reserveStartDate, reserveEndDate, reserveGuests, reserveName, userName } = req.body;

    // 요청 데이터 검증
    if (!hotelId || !reserveStartDate || !reserveEndDate || !reserveGuests || !reserveName || !userName) {
        return res.status(400).json({ error: '모든 필드는 필수입니다.' });
    }

    try {
        const reservation = await Reservation.create({
            hotelId: hotelId,
            reserveStartDate: reserveStartDate,
            reserveEndDate: reserveEndDate,
            reserveGuests: reserveGuests,
            reserveName: reserveName,
            userName: userName
        });

        res.status(201).json({ message: `호텔 ${hotelId} 예약이 완료되었습니다.`, reservation });
    } catch (error) {
        console.error('예약 생성 중 오류 발생:', error);
        res.status(500).json({ error: '예약 생성 중 오류 발생' });
    }
});

// 사용자 예약 조회 API
app.get('/user/:username/reservations', async (req, res) => {
    try {
        const username = req.params.username;

        // 사용자 정보 가져오기
        const user = await User.findOne({
            where: { username }
        });

        if (!user) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 사용자의 예약 정보 가져오기
        const userReservations = await Reservation.findAll({
            where: { userName: username }
        });

        res.json(userReservations);
    } catch (err) {
        console.error('사용자 예약 조회 중 오류 발생:', err);
        res.status(500).json({ error: '사용자 예약 조회 중 오류 발생' });
    }
});

// 404 핸들러
app.use(function(req, res, next) {
  next(createError(404));
});

// 에러 핸들러
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// 서버 실행
app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다.`);
});

// 데이터베이스 동기화 실행
syncUserDatabase();
syncReservationDatabase();

module.exports = app;
