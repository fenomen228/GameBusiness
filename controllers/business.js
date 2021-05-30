const errorHandler = require('../utils/errorHandler');

const typeBusiness = require('../models/TypeBusiness');
const typeQuestion = require('../models/TypeQuestion');
const userBusiness = require('../models/UserBusiness');
const businessLvl = require('../models/BusinessLvl');
const userAnswer = require('../models/UserAnswer');
const saveUserAnswer = require('../models/SaveUserAnswer');
const checked = require('../models/Checked');
const Profile = require('../models/Profile');
const Articles = require('../models/Articles');

const number_answer = 3;
const status_answer_expectation_answer = "expectation_answer"; // ждет ответа
const status_answer_assessment_answer = "assessment_answer"; // ответ отправлен, ждет оценки
const status_answer_stop = "stop"; // Остановка бизнеса до повышения лвл
const status_checked_false = "false"; // не может проверять чужие ответы
const status_checked_true = "true"; // может проверять чужие ответы

//+
// получения всех бизнесов
module.exports.outputBusiness = async function(req, res) {
    try {
        console.log('0000000000')
        const business = await typeBusiness.find();
        console.log(business)
        res.status(201).json(business);
    } catch(e) {
        errorHandler(res, e);
    }
}

//+
// Изменение баланса юзера
async function user_finance(profile, add_amount) {
    profile.finance = Number.parseInt(profile.finance) + Number.parseInt(add_amount) + "";

    await profile.save();
}

//+
// Создание нового бизнеса
module.exports.createNewBusiness = async function(req, res) {
    try {
        let business_user_all = await userBusiness.findOne({
            id_business: req.body.id_new_business,
            id_user: req.user.id
        });
        // Проверяем не создан ли уже этот бизнес
        if (!business_user_all) {
            let business = await typeBusiness.findOne({
                _id: req.body.id_new_business
            });
            let profile = await Profile.findOne({
                id_user: req.user.id
            });
            if (Number.parseInt(profile.finance) >= Number.parseInt(business.valuable)) {
                // Отнимаем деньги за бизнес
                await user_finance(profile, Number.parseInt(business.valuable) * (-1));
                let question = await typeQuestion.findOne({
                    id_business: req.body.id_new_business,
                    lvl: 1
                });
                console.log(question);
                let newBusiness = new userBusiness({
                    id_user: req.user.id,
                    id_business: req.body.id_new_business,
                    name: req.body.name_new_business,
                    id_question: question._id,
                    finance_business: 1000,
                    business_lvl: 1,
                    lvl: 1,
                    status_answer: status_answer_expectation_answer,
                    status_checked: status_checked_false,
                    imageSrc: business.imageSrc
                });
                console.log("000000000000");
                await newBusiness.save();

                const user_businesses = await userBusiness.find({id_user: req.user.id});

                res.status(201).json(user_businesses);
            } else {
                res.status(401).json({"message": "Нехвататет средств"});
            }
        } else {
            res.status(401).json({"message": "Такой бизнесс уже создан"});
        }
    } catch(e) {
        errorHandler(res, e);
    }
}

// Сделать через GET -----
// Получения всех бизнесов по id (или получение одного бизнеса по его айди + его вопроса)
// Сделать - Если передан id проверка по статусам, и если нужно повышаем лвл и сохраняем прошлый ответ
module.exports.outputUserBusinessesAll = async function(req, res) {
    try {
        const type_businesses = await typeBusiness.find();
        const user_businesses = await userBusiness.find({id_user: req.user.id});
        res.status(201).json({
            type_businesses: type_businesses,
            user_businesses: user_businesses
        });
    } catch(e) {
        errorHandler(res, e);
    }
}

//+
module.exports.outputUserBusiness = async function(req, res) {
    const BusinessIdUSer = req.params.id
    try {
        let user_business = await userBusiness.findOne({
            _id: BusinessIdUSer,
            id_user: req.user.id
        });
        if (user_business.status_answer !== status_answer_expectation_answer) {
            if (user_business.status_answer === status_answer_stop) {
                const now = new Date();
                const pos_now = user_business.date_waiting;
                pos_now.setHours(pos_now.getHours() + 12);
                if (pos_now < now) {
                    // блокируем проверку, даже если она уже заблокирована
                    user_business.status_checked = status_checked_false;

                    // разрешаем отправить ответ
                    user_business.status_answer = status_answer_expectation_answer;

                    // повышаем лвл вопроса
                    user_business.lvl = Number.parseInt(user_business.lvl) + 1;

                    // получаем слудующий вопрос
                    const new_question = await typeQuestion.findOne({
                        id_business: user_check_business.id_business,
                        lvl: user_check_business.lvl
                    });
                    user_business.id_question = new_question._id;

                    await user_business.save();
                }
            }
        }
        let business_lvl = await businessLvl.findOne({
            lvl: user_business.lvl
        });
        res.status(201).json({
            user_business: user_business,
            amount_improvement: business_lvl.amount_improvement
        });
    } catch(e) {
        errorHandler(res, e);
    }
}

//+
// Изменение баланса бизнеса
async function business_finance(business, add_amount) {
    business.finance_business = Number.parseInt(business.finance_business) +
        Number.parseInt(add_amount) + "";
    return business;
}

//+
// Запрос на повышение бизнес_лвл
module.exports.increaseBusinessLvl = async function(req, res) {
    try {
        if (req.body.id_business) {
            // Находим бизнес пользователя который он передал
            let user_business = await userBusiness.findOne({
                _id: req.body.id_business,
                id_user: req.user.id
            });

            // Находим бизнес лвл
            let business_lvl = await businessLvl.findOne({
                lvl: user_business.lvl
            });
            let amount_improvement = Number.parseInt(business_lvl.amount_improvement);
            let finance_business = Number.parseInt(user_business.finance_business);
            // Проверяем хватате ли денег для повышения бизнес лвл
            if (finance_business >= amount_improvement) {
                // отнимаем деньги бизнесса
                let pomegytok = amount_improvement * (-1);
                user_business = await business_finance(user_business, pomegytok);
                // повышаем бизнес лвл
                user_business.lvl = Number.parseInt(user_business.lvl) + 1;
                // Повышаем очки профиля, и если уже 100 то повышаем общий лвл
                let profile = await Profile.findOne({
                    id_user: req.user.id
                });
                profile.scores = Number.parseInt(profile.scores) + 25;
                if (Number.parseInt(profile.scores) >= 100) {
                    profile.lvl = Number.parseInt(profile.lvl) + 1;
                    profile.scores = 0;
                }
                // Сохраняем новые данные профиля
                await profile.save();
                // Сохраняем изменения
                await user_business.save();
                let business_lvl = await businessLvl.findOne({
                    lvl: user_business.lvl
                });
                res.status(201).json({
                    user_business: user_business,
                    amount_improvement: business_lvl.amount_improvement
                });

            } else {
                res.status(404).json({"message": "Нехвататет средств"});
            }
        } else {
            res.status(404).json({"message": "Нехвататет данных"});
        }
    } catch(e) {
        errorHandler(res, e);
    }
}

// Сделать на проверку получения пустоты и нуля------------
// Запрос на вывод денег из бизнеса
// Получаем бизнес юзера, количество денег на вывод(withdrawal_money)
module.exports.withdrawalMoneyBusiness = async function(req, res) {
    try {
        if (req.body.id_user_business) {
            // Находим бизнес пользователя который он передал
            let user_business = await userBusiness.findOne({
                _id: req.body.id_user_business,
                id_user: req.user.id
            });
            let profile = await Profile.findOne({
                id_user: req.user.id
            });
            // Проверяем хватает ли денег на вывод
            if (Number.parseInt(user_business.finance_business) >= Number.parseInt(req.body.withdrawal_money)) {
                // Отнимаем деньги у бизнеса
                user_business = await business_finance(user_business, Number.parseInt(req.body.withdrawal_money) * (-1));
                // Прибавляем деньги юзеру
                await user_finance(profile, req.body.withdrawal_money);
                // Сохраняем изменения
                await user_business.save();
                res.status(201).json({message: "Деньги выведены"});
            } else {
                res.status(404).json({message: "Нехвататет средств"});
            }
        }
    } catch(e) {
        errorHandler(res, e);
    }
}

// Сделать через GET -----
// Получение данных о вопросе
// {"id_user_business": "text"}
module.exports.outputQuestion = async function(req, res) {
    try {
        const user_business = await userBusiness.findOne({
            _id: req.body.id_user_business,
            id_user: req.user.id
        });
        const type_question = await typeQuestion.findOne({
            _id: user_business.id_question
        });
        const article = await Articles.findOne({
            id_question: user_business.id_question
        });

        res.status(201).json({
            question: type_question,
            article: article
        });
    } catch(e) {
        errorHandler(res, e);
    }
}

// Провнрка на пустоту
// Добавление ответа на вопрос
module.exports.addAnswer = async function(req, res) {
    try {
        let user_business = await userBusiness.findOne({_id: req.body.id_user_business});
        if (user_business && user_business.id_user === req.user.id && user_business.status_answer === status_answer_expectation_answer) {
            user_business.status_answer = status_answer_assessment_answer;
            user_business.status_checked = status_checked_true;
            const newAnswer = new userAnswer({
                id_user: req.user.id,
                id_user_business: req.body.id_user_business,
                id_business: user_business.id_business,
                id_question: user_business.id_question,
                answer: req.body.answer,
                number_checks: 0,
                scores: 0,
                status: status_checked_true
            });
            await newAnswer.save();
            await user_business.save();
            res.status(201).json({message: "Ответ отправлен"});
        } else {
            res.status(404).json({message: "Ошибка."});
        }
    } catch(e) {
        errorHandler(res, e);
    }
}

//+
// перемешка масива в рандомном порядке
Array.prototype.shuffle = function(b) {
    var i = this.length, j, t;
    while( i ) {
        j = Math.floor( ( i-- ) * Math.random() );
        t = b && typeof this[i].shuffle!=='undefined' ? this[i].shuffle() : this[i];
        this[i] = this[j];
        this[j] = t;
    }
    return this;
};

// Сделать через  GET --------
// Получение ответов для проверки
module.exports.checkedAnswer = async function(req, res) {
    try {
        const user_business = await userBusiness.findOne({
            _id: req.body.id_user_business,
            id_user: req.user.id
        });
        if(user_business && user_business.status_checked === status_checked_true) {
            let answers = await userAnswer.find({
                id_question: user_business.id_question,
                status: status_checked_true
            });
            answers = answers.shuffle();
            let answers_checked = [];
            for (let i = 0; i < number_answer; i++) {
                const check = new checked({
                    id_answer: answers[i]._id,
                    id_checked: req.user.id,
                    id_business: user_business.id_business,
                });
                await check.save();
                answers_checked.push({
                    id: check._id,
                    answer: answers[i].answer
                });
            }

            res.status(201).json(answers_checked);
        } else {
            res.status(401).json({message: "Вы не можете оценивать ответы"});
        }
    } catch(e) {
        errorHandler(res, e);
    }
}

// Сделать проверку на качество полученных данных------------
// Сдача оцененых ответов
// {id_user_business: "64566", answer_id: ["2044", "2043", "2042"], win: "2044"}
module.exports.handCheckAnswer = async function(req, res) {
    try {
        let user_business = await userBusiness.findOne({
            _id: req.body.id_user_business,
            id_user: req.user.id
        });
        if(user_business && user_business.status_checked === status_checked_true) {
            for (let i = 0; i < number_answer; i++) {
                const check = await checked.findOne({
                    _id: req.body.answer_id[i],
                    id_business: user_business.id_business
                });
                if (check && check.id_checked === req.user.id) {
                    const user_answer = await userAnswer.findOne({_id: check.id_answer});
                    user_answer.number_checks = Number.parseInt(user_answer.number_checks) + 1;
                    if (req.body.answer_id[i] === req.body.win) {
                        user_answer.scores = Number.parseInt(user_answer.scores) + 1;
                    }
                    if (user_answer.number_checks === number_answer) {
                        // Сохраняем ответ повышаем лвл, ставим на ожидание 12 часов
                        let user_check_business = await userBusiness.findOne({_id: user_answer.id_user_business});
                        // сохраняем овтет в прошлые ответы
                        const save_answer = new saveUserAnswer({
                            id_user: user_answer.id_user,
                            id_user_business: user_answer._id,
                            id_business: user_answer.id_business,
                            id_question: user_answer.id_question,
                            answer: user_answer.answer,
                            lvl: user_check_business.lvl,
                            scores: user_answer.scores
                        });
                        await save_answer.save();
                        // меняем статус ответа в userBusiness = ожидает 12 часов
                        user_check_business.status_answer = status_answer_stop;
                        // ставим время во сколкьо был проверен ответ
                        user_check_business.date_waiting = new Date();
                        // добавляем заслужаные деньги бизнесу, зависит от оценки
                        // Находим бизнес лвл
                        let business_lvl = await businessLvl.findOne({
                            lvl: user_business.business_lvl
                        });
                        // добавить + деньги за ответ, по оценке
                        let add_money = Number.parseInt(business_lvl.amount_answer) * user_answer.scores
                        user_check_business = await business_finance(user_check_business, add_money);

                        await user_check_business.save();
                        // Удаляем ответ из проверок
                        await user_answer.deleteOne();
                    } else {
                        await user_answer.save();
                    }
                    await check.delete();
                }
            }
            // проверил чужие ответы
            // Находим бизнес лвл
            let business_lvl = await businessLvl.findOne({
                lvl: user_business.business_lvl
            });

            // добавить + деньги за проверку чужих ответов
            user_business = await business_finance(user_business, business_lvl.amount_appraisal);

            user_business.status_checked = status_checked_false;
            await user_business.save();
            res.status(201).json({message: "Ответы оценены"});
        } else {
            res.status(404).json({message: "Вам не разрешена проверка чужих ответов"});
        }

    } catch (e) {
        errorHandler(res, e);
    }
}
